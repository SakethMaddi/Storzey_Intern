import { afterEach, describe, expect, it } from "vitest";
import { LISTEN_HOST } from "./server.js";
import { createServer } from "./app.js";
import { isGlobalRateLimitExempt } from "./lib/rate-limit.js";
import type { FastifyInstance } from "fastify";

const prodEnv = {
  DATABASE_URL: "postgresql://user:pass@ep-host.neon.tech/dbname?sslmode=require",
  JWT_SECRET: "super_secure_jwt_secret_with_more_than_32_characters_for_prod",
  FRONTEND_URL: "https://advancepay.example.com",
  CORS_ORIGIN: "https://advancepay.example.com",
  RAZORPAY_KEY_ID: "rzp_test_1234567890abcdef",
  RAZORPAY_KEY_SECRET: "sec_test_1234567890abcdef",
  RAZORPAY_WEBHOOK_SECRET: "whsec_1234567890abcdef",
  PORT: 8080,
  NODE_ENV: "production",
  isProduction: true,
};

describe("production server configuration", () => {
  const apps: FastifyInstance[] = [];
  const originalSecret = process.env.PROXY_SHARED_SECRET;

  afterEach(async () => {
    if (originalSecret === undefined) delete process.env.PROXY_SHARED_SECRET;
    else process.env.PROXY_SHARED_SECRET = originalSecret;
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  it("listens on Railway's port and on all interfaces", () => {
    expect(LISTEN_HOST).toBe("0.0.0.0");
    expect(prodEnv.PORT).toBe(8080);
  });

  it("allows only the configured frontend origin in production", async () => {
    const app = await createServer(prodEnv);
    apps.push(app);

    const allowed = await app.inject({
      method: "OPTIONS",
      url: "/auth/login",
      headers: {
        origin: "https://advancepay.example.com",
        "access-control-request-method": "POST",
      },
    });
    expect(allowed.headers["access-control-allow-origin"]).toBe(
      "https://advancepay.example.com"
    );
    expect(allowed.headers["access-control-allow-credentials"]).toBe("true");

    const localhost = await app.inject({
      method: "OPTIONS",
      url: "/auth/login",
      headers: {
        origin: "http://localhost:5173",
        "access-control-request-method": "POST",
      },
    });
    expect(localhost.headers["access-control-allow-origin"]).not.toBe(
      "http://localhost:5173"
    );

    const devApp = await createServer({ ...prodEnv, NODE_ENV: "development", isProduction: false });
    apps.push(devApp);
    const devLocal = await devApp.inject({
      method: "OPTIONS",
      url: "/auth/login",
      headers: {
        origin: "http://localhost:5173",
        "access-control-request-method": "POST",
      },
    });
    expect(devLocal.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
  });

  it("rejects cookie mutations with a missing or unapproved origin", async () => {
    const app = await createServer(prodEnv);
    apps.push(app);
    const token = app.jwt.sign({ ownerId: 1, role: "owner", email: "owner@example.com" });

    const missing = await app.inject({
      method: "POST",
      url: "/customers",
      cookies: { token },
      headers: { "x-requested-with": "XMLHttpRequest" },
      payload: { name: "Asha", phone: "9876543210" },
    });
    expect(missing.statusCode).toBe(403);

    const localhost = await app.inject({
      method: "POST",
      url: "/customers",
      cookies: { token },
      headers: {
        origin: "http://localhost:5173",
        "x-requested-with": "XMLHttpRequest",
      },
      payload: { name: "Asha", phone: "9876543210" },
    });
    expect(localhost.statusCode).toBe(403);
    expect(localhost.json().message).toContain("not allowed by CORS");
  });

  it("exempts only POST /webhooks/razorpay from the global limit", async () => {
    expect(isGlobalRateLimitExempt("POST", "/webhooks/razorpay")).toBe(true);
    expect(isGlobalRateLimitExempt("POST", "/webhooks/razorpay?x=1")).toBe(true);
    expect(isGlobalRateLimitExempt("POST", "/api/webhooks/razorpay")).toBe(false);
    expect(isGlobalRateLimitExempt("GET", "/webhooks/razorpay")).toBe(false);

    const app = await createServer(prodEnv);
    apps.push(app);

    for (let i = 0; i < 101; i++) {
      const res = await app.inject({
        method: "POST",
        url: "/webhooks/razorpay",
        remoteAddress: "198.51.100.40",
        payload: {},
      });
      expect(res.statusCode).not.toBe(429);
      expect(res.statusCode).toBe(400);
    }

    for (let i = 0; i < 100; i++) {
      const res = await app.inject({
        method: "GET",
        url: "/",
        remoteAddress: "198.51.100.41",
      });
      expect(res.statusCode).toBe(200);
    }
    const blocked = await app.inject({
      method: "GET",
      url: "/",
      remoteAddress: "198.51.100.41",
    });
    expect(blocked.statusCode).toBe(429);
  });
});
