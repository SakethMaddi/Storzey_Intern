export const config = {
  matcher: [
    "/auth",
    "/auth/:path*",
    "/customers",
    "/customers/:path*",
    "/orders",
    "/orders/:path*",
    "/stages",
    "/stages/:path*",
    "/payments",
    "/payments/:path*",
    "/dashboard",
    "/dashboard/:path*",
    "/admin",
    "/admin/:path*",
    "/api/:path*",
  ],
};

const PROXIED_API_PREFIXES = [
  "/auth",
  "/customers",
  "/orders",
  "/stages",
  "/payments",
  "/dashboard",
  "/admin",
  "/api",
] as const;

const IPV4 = /^(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const IPV6 = /^[0-9a-fA-F:]+$/;

function isSingleIp(value: string): boolean {
  return IPV4.test(value) || (value.includes(":") && IPV6.test(value) && !value.includes(","));
}

function isProxiedApiPath(pathname: string): boolean {
  return PROXIED_API_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function parseBackendOrigin(raw: string | undefined): URL | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  if (url.protocol !== "https:") return null;
  if (!url.hostname) return null;
  if (url.username || url.password) return null;
  if (url.pathname !== "/" && url.pathname !== "") return null;
  if (url.search || url.hash) return null;
  return url;
}

function resolveProxyTarget(
  pathname: string,
  search: string,
  backendOrigin: string
): string | null {
  if (!isProxiedApiPath(pathname)) return null;
  const origin = parseBackendOrigin(backendOrigin);
  if (!origin) return null;
  const target = new URL(`${pathname}${search}`, origin);
  return target.toString();
}

function clientIpFromProxyHeaders(headers: Headers): string | null {
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp && isSingleIp(realIp)) return realIp;

  const forwarded = headers.get("x-forwarded-for");
  if (!forwarded) return null;
  const first = forwarded.split(",")[0]?.trim() ?? "";
  if (first && isSingleIp(first)) return first;
  return null;
}

const HOP_BY_HOP = new Set([
  "host",
  "connection",
  "content-length",
  "transfer-encoding",
  "keep-alive",
  "upgrade",
  "proxy-connection",
  "te",
  "trailer",
]);

const RESPONSE_HOP_BY_HOP = new Set([
  "content-encoding",
  "content-length",
  "transfer-encoding",
  "connection",
  "keep-alive",
  "set-cookie",
]);

function buildUpstreamHeaders(
  incoming: Headers,
  proxySecret: string | undefined,
  clientIp: string | null
): Headers {
  const headers = new Headers();
  incoming.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (HOP_BY_HOP.has(lower)) return;
    if (lower === "x-advancepay-proxy-token" || lower === "x-advancepay-client-ip") return;
    headers.append(key, value);
  });

  if (proxySecret && clientIp) {
    headers.set("x-advancepay-proxy-token", proxySecret);
    headers.set("x-advancepay-client-ip", clientIp);
  }

  return headers;
}

function copyProxiedHeaders(upstream: Response): Headers {
  const headers = new Headers();
  try {
    upstream.headers.forEach((value, key) => {
      if (RESPONSE_HOP_BY_HOP.has(key.toLowerCase())) return;
      headers.append(key, value);
    });

    const setCookies =
      typeof upstream.headers.getSetCookie === "function"
        ? upstream.headers.getSetCookie()
        : [];
    if (setCookies.length === 0) {
      const single = upstream.headers.get("set-cookie");
      if (single) setCookies.push(single);
    }
    for (const cookie of setCookies) {
      headers.append("set-cookie", cookie);
    }
  } catch (err) {
    // Non-fatal header copy failure
  }
  return headers;
}

function proxyFailure(status: number, message: string): Response {
  return new Response(JSON.stringify({ success: false, message }), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function getSafeEnv(name: string): string | undefined {
  try {
    if (typeof process !== "undefined" && process?.env) {
      return process.env[name];
    }
  } catch {}
  try {
    if (typeof (globalThis as any)[name] === "string") {
      return (globalThis as any)[name];
    }
  } catch {}
  return undefined;
}

export default async function middleware(request: Request): Promise<Response> {
  try {
    const incomingUrl = new URL(request.url);
    const backendOrigin = getSafeEnv("RAILWAY_API_ORIGIN");

    if (!parseBackendOrigin(backendOrigin)) {
      return proxyFailure(
        503,
        "API proxy is not configured: Please set RAILWAY_API_ORIGIN in Vercel project environment variables to your backend HTTPS origin."
      );
    }

    const target = resolveProxyTarget(
      incomingUrl.pathname,
      incomingUrl.search,
      backendOrigin as string
    );
    if (!target) {
      return proxyFailure(404, "API path is not proxied");
    }

    const clientIp = clientIpFromProxyHeaders(request.headers);
    const proxySecret = getSafeEnv("PROXY_SHARED_SECRET");
    const headers = buildUpstreamHeaders(request.headers, proxySecret, clientIp);

    const hasBody = request.method !== "GET" && request.method !== "HEAD";
    let upstream: Response;

    try {
      upstream = await fetch(target, {
        method: request.method,
        headers,
        body: hasBody ? request.body : undefined,
        redirect: "manual",
        ...(hasBody ? { duplex: "half" } : {}),
      } as RequestInit);
    } catch (fetchErr: any) {
      const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
      return proxyFailure(
        502,
        `Backend gateway error: Unable to connect to upstream API at ${backendOrigin} (${msg})`
      );
    }

    // Status 204 (No Content) and 304 (Not Modified) prohibit a response body per fetch specification
    const isBodylessStatus = upstream.status === 204 || upstream.status === 304;
    const responseBody = isBodylessStatus || request.method === "HEAD" ? null : upstream.body;

    return new Response(responseBody, {
      status: upstream.status,
      headers: copyProxiedHeaders(upstream),
    });
  } catch (err: any) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return proxyFailure(500, `Middleware error: ${errorMsg}`);
  }
}
