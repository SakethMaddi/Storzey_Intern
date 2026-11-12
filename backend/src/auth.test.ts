import { describe, it, expect, beforeAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifyJwt from "@fastify/jwt";
import cors from "@fastify/cors";
import bcrypt from "bcrypt";
import { loginSchema, ownerRegisterSchema } from "./lib/validation.js";
import { validateJwtSecret } from "./lib/jwt.js";
import { authService } from "./modules/auth/auth.service.js";

describe("Owner Authentication Endpoints & Middleware", () => {
  let app: FastifyInstance;
  const OWNER_EMAIL = "owner@advancepay.com";
  const OWNER_PASSWORD = "OwnerSecurePassword2026!";
  const JWT_SECRET = "test_jwt_secret_key_1234567890";

  // In-memory mock DB for testing owner registration logic
  let mockOwners: Array<{ id: number; name: string; email: string; password: string }> = [];

  beforeAll(async () => {
    app = Fastify();
    await app.register(cors);
    await app.register(fastifyCookie);
    await app.register(fastifyJwt, {
      secret: JWT_SECRET,
      cookie: {
        cookieName: "token",
        signed: false,
      },
    });

    // Authentication middleware
    app.decorate("authenticateOwner", async (request: any, reply: any) => {
      try {
        const token =
          request.cookies?.token ||
          request.headers.authorization?.replace(/^Bearer\s+/, "");
        if (!token) {
          return reply.code(401).send({
            success: false,
            message: "Unauthorized. Authentication is required to access owner features.",
          });
        }
        const decoded = await app.jwt.verify(token);
        request.user = decoded;
      } catch (err) {
        return reply.code(401).send({
          success: false,
          message: "Session expired or invalid token. Please log in again.",
        });
      }
    });

    // Registration status endpoint
    app.get("/auth/registration-status", async () => {
      return {
        success: true,
        data: {
          registrationOpen: mockOwners.length === 0,
          hasOwner: mockOwners.length > 0,
        },
      };
    });

    // Registration endpoint
    app.post("/auth/register", async (request, reply) => {
      const parseResult = ownerRegisterSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.code(400).send({
          success: false,
          message: parseResult.error.issues[0]?.message || "Invalid registration data",
          errors: parseResult.error.flatten().fieldErrors,
        });
      }

      if (mockOwners.length > 0) {
        return reply.code(403).send({
          success: false,
          message: "Registration is closed. An owner account has already been registered.",
        });
      }

      const { name, email, password } = parseResult.data;
      const hashedPassword = await bcrypt.hash(password, 10);
      const newOwner = { id: 1, name, email, password: hashedPassword };
      mockOwners.push(newOwner);

      return reply.code(201).send({
        success: true,
        message: "Owner account registered successfully. Please log in.",
        data: { id: newOwner.id, name: newOwner.name, email: newOwner.email },
      });
    });

    // Login route
    app.post("/auth/login", async (request, reply) => {
      const parseResult = loginSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.code(400).send({
          success: false,
          message: parseResult.error.issues[0]?.message || "Invalid email or password",
        });
      }
      const { email, password } = parseResult.data;
      const dbOwner = mockOwners.find((o) => o.email === email);
      let isValid = false;
      let name = "Owner";

      if (dbOwner) {
        isValid = await bcrypt.compare(password, dbOwner.password);
        name = dbOwner.name;
      } else if (email === OWNER_EMAIL && password === OWNER_PASSWORD) {
        isValid = true;
      }

      if (!isValid) {
        return reply.code(401).send({
          success: false,
          message: "Invalid email or password",
        });
      }

      const token = app.jwt.sign({ role: "owner", email, name }, { expiresIn: "1h" });
      reply.setCookie("token", token, {
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "lax",
      });

      return reply.send({
        success: true,
        message: "Logged in successfully",
        data: { email, name, role: "owner" },
      });
    });

    // Logout route
    app.post("/auth/logout", async (request, reply) => {
      reply.clearCookie("token", { path: "/", httpOnly: true, sameSite: "lax" });
      return reply.send({ success: true, message: "Logged out successfully" });
    });

    // Protected route
    app.get("/auth/me", { preHandler: [(app as any).authenticateOwner] }, async (request, reply) => {
      return reply.send({
        success: true,
        data: (request as any).user,
      });
    });

    // Protected dashboard mock endpoint
    app.get("/orders", { preHandler: [(app as any).authenticateOwner] }, async () => {
      return { success: true, data: [] };
    });

    // Public mock endpoint
    app.get("/api/public/orders/:token", async (req, reply) => {
      return reply.send({ success: true, message: "Public order tracking" });
    });
  });

  it("1. Blocks unauthenticated access to protected owner endpoint", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/orders",
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().success).toBe(false);
    expect(res.json().message).toContain("Unauthorized");
  });

  it("2. Validates registration inputs (short password, mismatched confirm password)", async () => {
    // Short password
    const shortRes = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        name: "Boutique Owner",
        email: "owner@boutique.com",
        password: "123",
        confirmPassword: "123",
      },
    });
    expect(shortRes.statusCode).toBe(400);
    expect(shortRes.json().message).toContain("at least 8 characters");

    // Mismatched passwords
    const mismatchRes = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        name: "Boutique Owner",
        email: "owner@boutique.com",
        password: "Password123!",
        confirmPassword: "PasswordDifferent!",
      },
    });
    expect(mismatchRes.statusCode).toBe(400);
    expect(mismatchRes.json().message).toBe("Passwords do not match");
  });

  it("3. Successfully registers first owner with bcrypt hashed password", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        name: "Boutique Owner",
        email: "boutique.owner@advancepay.com",
        password: "OwnerSuperPassword2026!",
        confirmPassword: "OwnerSuperPassword2026!",
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().success).toBe(true);
    expect(res.json().data.email).toBe("boutique.owner@advancepay.com");
    expect(mockOwners.length).toBe(1);
    const created = mockOwners[0];
    expect(created).toBeDefined();
    expect(created?.password).not.toBe("OwnerSuperPassword2026!");
    expect(await bcrypt.compare("OwnerSuperPassword2026!", created?.password || "")).toBe(true);
  });

  it("4. Blocks subsequent owner registrations once an owner exists", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        name: "Intruder Second Owner",
        email: "intruder@domain.com",
        password: "IntruderPassword2026!",
        confirmPassword: "IntruderPassword2026!",
      },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().success).toBe(false);
    expect(res.json().message).toContain("Registration is closed");
  });

  it("5. Allows newly registered owner to log in with bcrypt password", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email: "boutique.owner@advancepay.com",
        password: "OwnerSuperPassword2026!",
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
    expect(res.json().data.name).toBe("Boutique Owner");
    // Verify raw JWT is NOT emitted in response JSON
    expect(res.json().data.token).toBeUndefined();

    const tokenCookie = res.cookies.find((c) => c.name === "token");
    expect(tokenCookie).toBeDefined();
    expect(tokenCookie?.httpOnly).toBe(true);
  });

  it("6. Rejects login with incorrect password", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email: "boutique.owner@advancepay.com",
        password: "WrongPassword!",
      },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().success).toBe(false);
    expect(res.json().message).toBe("Invalid email or password");
  });

  it("7. Allows access to protected owner route when cookie is provided", async () => {
    const token = app.jwt.sign({ role: "owner", email: OWNER_EMAIL }, { expiresIn: "1h" });
    const res = await app.inject({
      method: "GET",
      url: "/orders",
      cookies: {
        token,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
  });

  it("8. Allows access to protected owner route when Bearer token header is provided", async () => {
    const token = app.jwt.sign({ role: "owner", email: OWNER_EMAIL }, { expiresIn: "1h" });
    const res = await app.inject({
      method: "GET",
      url: "/auth/me",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.email).toBe(OWNER_EMAIL);
  });

  it("9. Rejects expired JWT token with 401 Session expired", async () => {
    const expiredToken = app.jwt.sign(
      { role: "owner", email: OWNER_EMAIL },
      { expiresIn: "-10s" }
    );
    const res = await app.inject({
      method: "GET",
      url: "/orders",
      cookies: {
        token: expiredToken,
      },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().message).toContain("Session expired");
  });

  it("10. Logout clears the token cookie", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/logout",
    });
    expect(res.statusCode).toBe(200);
    const tokenCookie = res.cookies.find((c) => c.name === "token");
    expect(tokenCookie?.value).toBe("");
  });

  it("11. Public tracking API remains completely accessible without authentication", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/public/orders/any-uuid-token",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
  });

  describe("HIGH-1: JWT_SECRET and Fallback Credential Hardening", () => {
    it("12. Fails in production if JWT_SECRET is missing", () => {
      const res = validateJwtSecret("", true);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain("missing in production");
    });

    it("13. Fails in production if JWT_SECRET is shorter than 32 characters", () => {
      const res = validateJwtSecret("short_secret_under_32", true);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain("at least 32 characters long");
    });

    it("14. Fails in production if JWT_SECRET is a known placeholder", () => {
      const res = validateJwtSecret("advance_pay_super_secret_jwt_key_2026_change_in_production", true);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain("insecure default or placeholder");
    });

    it("15. Succeeds in production when given a strong, non-placeholder secret >= 32 characters", () => {
      const validSecret = "c8d4f09a1e2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d";
      const res = validateJwtSecret(validSecret, true);
      expect(res.isValid).toBe(true);
      expect(res.secret).toBe(validSecret);
    });

    it("16. Rejects login when no DB owner exists and environment OWNER_PASSWORD is empty or missing", async () => {
      const originalEnvPass = process.env.OWNER_PASSWORD;
      try {
        delete process.env.OWNER_PASSWORD;
        // Verify against non-existent DB owner
        const check = await authService.verifyOwnerCredentials("nonexistent@advancepay.com", "OwnerSecurePassword2026!");
        expect(check.isAuthenticated).toBe(false);
      } finally {
        if (originalEnvPass) process.env.OWNER_PASSWORD = originalEnvPass;
      }
    });

    it("17. Rejects login if attempting default 'OwnerSecurePassword2026!' when unset", async () => {
      const originalEnvPass = process.env.OWNER_PASSWORD;
      try {
        delete process.env.OWNER_PASSWORD;
        const check = await authService.verifyOwnerCredentials("owner@advancepay.com", "OwnerSecurePassword2026!");
        expect(check.isAuthenticated).toBe(false);
      } finally {
        if (originalEnvPass) process.env.OWNER_PASSWORD = originalEnvPass;
      }
    });

    it("18. Login response completely omits token and sets HttpOnly cookie", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: {
          email: "boutique.owner@advancepay.com",
          password: "OwnerSuperPassword2026!",
        },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.token).toBeUndefined();
      const cookie = res.cookies.find((c) => c.name === "token");
      expect(cookie).toBeDefined();
      expect(cookie?.httpOnly).toBe(true);
      expect(cookie?.sameSite?.toLowerCase()).toBe("lax");
    });
  });
});


