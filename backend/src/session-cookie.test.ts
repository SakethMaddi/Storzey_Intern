import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifyJwt from "@fastify/jwt";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { SESSION_MAX_AGE_SECONDS } from "./modules/auth/session-cookie.js";

const auth = vi.hoisted(() => ({
  verifyOwnerCredentials: vi.fn(),
  registerOwner: vi.fn(),
  getOwnerProfile: vi.fn(),
  getRegistrationStatus: vi.fn(),
  updateProfile: vi.fn(),
  changePassword: vi.fn(),
}));

vi.mock("./modules/auth/auth.service.js", () => ({
  authService: auth,
}));

describe("session cookies", () => {
  let app: FastifyInstance;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeAll(async () => {
    app = Fastify();
    await app.register(fastifyCookie);
    await app.register(fastifyJwt, {
      secret: "test_session_cookie_secret_with_32_characters",
      cookie: { cookieName: "token", signed: false },
    });
    app.decorate("authenticateOwner", async (request: any, reply: any) => {
      try {
        await request.jwtVerify();
      } catch {
        return reply.code(401).send({ success: false, message: "Unauthorized" });
      }
    });
    await app.register(authRoutes);
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    vi.clearAllMocks();
  });

  it("login sets an HttpOnly Lax cookie and does not return the JWT", async () => {
    process.env.NODE_ENV = "production";
    auth.verifyOwnerCredentials.mockResolvedValue({
      isAuthenticated: true,
      ownerId: 7,
      ownerName: "Asha",
      businessName: "Boutique",
    });

    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "owner@example.com", password: "correct-password" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.token).toBeUndefined();
    expect(body.data.token).toBeUndefined();
    expect(body.data.password).toBeUndefined();
    expect(JSON.stringify(body)).not.toMatch(/eyJ[A-Za-z0-9_-]+\./);

    const header = String(res.headers["set-cookie"]);
    expect(header).toContain("HttpOnly");
    expect(header).toContain("Secure");
    expect(header).toContain("SameSite=Lax");
    expect(header).toContain("Path=/");
    expect(header).toContain(`Max-Age=${SESSION_MAX_AGE_SECONDS}`);

    const cookie = res.cookies.find((item) => item.name === "token");
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.secure).toBe(true);
    expect(cookie?.sameSite).toBe("Lax");
    expect(cookie?.path).toBe("/");
  });

  it("registration uses the same cookie and omits the JWT", async () => {
    process.env.NODE_ENV = "production";
    auth.registerOwner.mockResolvedValue({
      status: "SUCCESS",
      owner: {
        id: 8,
        email: "new@example.com",
        name: "New Owner",
        phone: "9876543210",
        businessName: "Studio",
      },
    });

    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        name: "New Owner",
        email: "new@example.com",
        phone: "9876543210",
        businessName: "Studio",
        password: "correct-password",
        confirmPassword: "correct-password",
      },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().data.token).toBeUndefined();
    expect(String(res.headers["set-cookie"])).toContain("HttpOnly");
    expect(String(res.headers["set-cookie"])).toContain(`Max-Age=${SESSION_MAX_AGE_SECONDS}`);
  });

  it("keeps the cookie across /auth/me and clears it on logout", async () => {
    process.env.NODE_ENV = "production";
    auth.verifyOwnerCredentials.mockResolvedValue({
      isAuthenticated: true,
      ownerId: 7,
      ownerName: "Asha",
      businessName: "Boutique",
    });
    auth.getOwnerProfile.mockResolvedValue({
      id: 7,
      email: "owner@example.com",
      name: "Asha",
      phone: null,
      businessName: "Boutique",
    });

    const login = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "owner@example.com", password: "correct-password" },
    });
    const token = login.cookies.find((item) => item.name === "token")?.value;
    expect(token).toBeTruthy();

    const me = await app.inject({
      method: "GET",
      url: "/auth/me",
      cookies: { token: token as string },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json().data.email).toBe("owner@example.com");
    expect(me.json().data.token).toBeUndefined();

    const logout = await app.inject({
      method: "POST",
      url: "/auth/logout",
      cookies: { token: token as string },
    });
    expect(logout.statusCode).toBe(200);
    const cleared = String(logout.headers["set-cookie"]);
    expect(cleared).toContain("token=");
    expect(cleared).toContain("HttpOnly");
    expect(cleared).toContain("Secure");
    expect(cleared).toContain("SameSite=Lax");
    expect(cleared).toContain("Path=/");
  });

  it("leaves Secure off outside production", async () => {
    process.env.NODE_ENV = "development";
    auth.verifyOwnerCredentials.mockResolvedValue({
      isAuthenticated: true,
      ownerId: 7,
      ownerName: "Asha",
      businessName: null,
    });

    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "owner@example.com", password: "correct-password" },
    });
    const header = String(res.headers["set-cookie"]);
    const cookie = res.cookies.find((item) => item.name === "token");
    expect(header).not.toContain("Secure");
    expect(cookie?.secure).not.toBe(true);
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("Lax");
  });
});
