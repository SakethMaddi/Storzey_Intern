/**
 * Browser API base URL.
 * Production uses same-origin paths. Vercel proxies those paths to Railway.
 * Development uses VITE_API_URL, or the local Fastify port when it is unset.
 */
export function resolveApiBaseUrl(
  isProduction: boolean,
  rawApiUrl: string | undefined
): string {
  const trimmed = rawApiUrl?.trim() ?? "";

  if (isProduction) {
    if (trimmed) {
      throw new Error(
        "[Advance Pay Production Error]: Do not set VITE_API_URL in production. The browser calls the Vercel origin, and Vercel proxies API paths to Railway."
      );
    }
    return "";
  }

  return trimmed.replace(/\/+$/, "") || "http://localhost:5001";
}
