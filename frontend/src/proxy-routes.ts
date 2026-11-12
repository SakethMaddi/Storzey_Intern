/**
 * Browser paths that Vercel forwards to Railway without changing the path.
 * Public tracking is already under /api. Other owner routes are not.
 * Forwarding the original path avoids turning /api/public into /public or /api/api/public.
 * Razorpay webhooks stay on the Railway origin so the raw body is not rewritten.
 */
export const PROXIED_API_PREFIXES = [
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

export function isSingleIp(value: string): boolean {
  return IPV4.test(value) || (value.includes(":") && IPV6.test(value) && !value.includes(","));
}

export function isProxiedApiPath(pathname: string): boolean {
  return PROXIED_API_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function parseBackendOrigin(raw: string | undefined): URL | null {
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

export function resolveProxyTarget(
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

export function clientIpFromProxyHeaders(headers: {
  get(name: string): string | null;
}): string | null {
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

export function buildUpstreamHeaders(
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
