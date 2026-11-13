import {
  buildUpstreamHeaders,
  clientIpFromProxyHeaders,
  parseBackendOrigin,
  resolveProxyTarget,
} from "./src/proxy-routes";

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

const RESPONSE_HOP_BY_HOP = new Set([
  "content-encoding",
  "content-length",
  "transfer-encoding",
  "connection",
  "keep-alive",
  "set-cookie",
]);

function proxyFailure(status: number, message: string): Response {
  return new Response(JSON.stringify({ success: false, message }), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function copyProxiedHeaders(upstream: Response): Headers {
  const headers = new Headers();
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
  return headers;
}

export default async function middleware(request: Request): Promise<Response> {
  const incomingUrl = new URL(request.url);
  const backendOrigin = process.env.RAILWAY_API_ORIGIN;
  if (!parseBackendOrigin(backendOrigin)) {
    return proxyFailure(503, "API proxy is not configured");
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
  const headers = buildUpstreamHeaders(
    request.headers,
    process.env.PROXY_SHARED_SECRET,
    clientIp
  );

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: hasBody ? request.body : undefined,
      redirect: "manual",
      ...(hasBody ? { duplex: "half" } : {}),
    } as RequestInit);

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: copyProxiedHeaders(upstream),
    });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    return proxyFailure(
      502,
      `Backend gateway error: Unable to connect to upstream API (${msg})`
    );
  }
}
