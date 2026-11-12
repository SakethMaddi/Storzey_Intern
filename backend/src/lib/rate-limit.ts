import { timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";

export const RAZORPAY_WEBHOOK_PATH = "/webhooks/razorpay";

export function isGlobalRateLimitExempt(method: string, url: string): boolean {
  if (method !== "POST") return false;
  const path = url.split("?")[0] ?? "";
  return path === RAZORPAY_WEBHOOK_PATH;
}

function headerValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0]?.trim() ?? "";
  return value?.trim() ?? "";
}

function secretsMatch(provided: string, expected: string): boolean {
  const providedBuf = Buffer.from(provided);
  const expectedBuf = Buffer.from(expected);
  if (providedBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(providedBuf, expectedBuf);
}

/**
 * Client IP forwarded by the Vercel proxy.
 * The header is ignored unless it arrives with the shared proxy secret.
 * A direct caller cannot choose their rate-limit identity by setting the header.
 */
export function trustedProxyClientIp(
  headers: Record<string, string | string[] | undefined>,
  proxySecret: string | undefined
): string | null {
  const secret = proxySecret?.trim();
  if (!secret) return null;

  const token = headerValue(headers["x-advancepay-proxy-token"]);
  if (!token || !secretsMatch(token, secret)) return null;

  const ip = headerValue(headers["x-advancepay-client-ip"]);
  if (!ip || !isIP(ip)) return null;
  return ip;
}
