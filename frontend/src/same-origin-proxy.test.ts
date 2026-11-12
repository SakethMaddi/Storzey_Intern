import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveApiBaseUrl } from "./api-base.ts";
import {
  buildUpstreamHeaders,
  isProxiedApiPath,
  parseBackendOrigin,
  resolveProxyTarget,
} from "./proxy-routes.ts";

const RAILWAY = "https://advance-pay-api.example.com";

describe("same-origin API base", () => {
  it("uses relative URLs in production", () => {
    assert.equal(resolveApiBaseUrl(true, undefined), "");
    assert.equal(resolveApiBaseUrl(true, "   "), "");
  });

  it("rejects a baked-in API URL in production", () => {
    assert.throws(
      () => resolveApiBaseUrl(true, "https://advance-pay-api.example.com"),
      /Do not set VITE_API_URL/
    );
  });

  it("keeps localhost for development only", () => {
    assert.equal(resolveApiBaseUrl(false, undefined), "http://localhost:5001");
    assert.equal(
      resolveApiBaseUrl(false, "http://localhost:5001/"),
      "http://localhost:5001"
    );
  });
});

describe("Vercel proxy paths", () => {
  it("forwards owner and public paths without adding or removing /api", () => {
    const cases = [
      ["/auth/login", `${RAILWAY}/auth/login`],
      ["/auth/me", `${RAILWAY}/auth/me`],
      ["/auth/logout", `${RAILWAY}/auth/logout`],
      ["/auth/register", `${RAILWAY}/auth/register`],
      ["/customers?page=1&archived=false", `${RAILWAY}/customers?page=1&archived=false`],
      ["/orders/4/payments", `${RAILWAY}/orders/4/payments`],
      ["/orders/4/razorpay-order", `${RAILWAY}/orders/4/razorpay-order`],
      ["/stages/9", `${RAILWAY}/stages/9`],
      ["/payments/verify", `${RAILWAY}/payments/verify`],
      ["/dashboard/stats", `${RAILWAY}/dashboard/stats`],
      ["/api/public/orders/tok", `${RAILWAY}/api/public/orders/tok`],
      [
        "/api/public/orders/tok/razorpay-order",
        `${RAILWAY}/api/public/orders/tok/razorpay-order`,
      ],
    ];

    for (const [input, expected] of cases) {
      const path = input ?? "";
      const queryIndex = path.indexOf("?");
      const pathname = queryIndex === -1 ? path : path.slice(0, queryIndex);
      const search = queryIndex === -1 ? "" : path.slice(queryIndex);
      assert.equal(resolveProxyTarget(pathname, search, RAILWAY), expected);
      assert.equal(expected.includes("/api/api/"), false);
    }
  });

  it("does not proxy the SPA, webhooks, or the health root", () => {
    assert.equal(isProxiedApiPath("/track/abc"), false);
    assert.equal(isProxiedApiPath("/webhooks/razorpay"), false);
    assert.equal(isProxiedApiPath("/"), false);
    assert.equal(resolveProxyTarget("/track/abc", "", RAILWAY), null);
    assert.equal(resolveProxyTarget("/webhooks/razorpay", "", RAILWAY), null);
  });

  it("rejects a backend origin that is not an https origin", () => {
    assert.equal(parseBackendOrigin("http://advance-pay-api.example.com"), null);
    assert.equal(parseBackendOrigin("https://user:pass@advance-pay-api.example.com"), null);
    assert.equal(parseBackendOrigin("https://advance-pay-api.example.com/api"), null);
    assert.equal(parseBackendOrigin(""), null);
  });

  it("drops client-supplied proxy credentials and keeps the session cookie", () => {
    const incoming = new Headers();
    incoming.set("cookie", "token=session");
    incoming.set("origin", "https://advance-pay.vercel.app");
    incoming.set("x-requested-with", "XMLHttpRequest");
    incoming.set("content-type", "application/json");
    incoming.set("host", "advance-pay.vercel.app");
    incoming.set("x-advancepay-proxy-token", "attacker");
    incoming.set("x-advancepay-client-ip", "1.2.3.4");

    const headers = buildUpstreamHeaders(incoming, "real-secret", "198.51.100.8");
    assert.equal(headers.get("cookie"), "token=session");
    assert.equal(headers.get("origin"), "https://advance-pay.vercel.app");
    assert.equal(headers.get("x-requested-with"), "XMLHttpRequest");
    assert.equal(headers.get("content-type"), "application/json");
    assert.equal(headers.get("host"), null);
    assert.equal(headers.get("x-advancepay-proxy-token"), "real-secret");
    assert.equal(headers.get("x-advancepay-client-ip"), "198.51.100.8");
  });
});
