import { describe, it, expect, beforeAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifyJwt from "@fastify/jwt";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { ownerRegisterSchema } from "./lib/validation.js";

describe("Owner Registration Validation & Scenarios", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    await app.register(fastifyCookie);
    await app.register(fastifyJwt, {
      secret: "super_secure_verification_secret_32_characters_minimum",
      cookie: {
        cookieName: "token",
        signed: false,
      },
    });

    app.decorate("authenticateOwner", async (request: any, reply: any) => {
      try {
        const token =
          request.cookies?.token ||
          request.headers.authorization?.replace(/^Bearer\s+/, "");
        if (!token) {
          return reply.code(401).send({ success: false, message: "Unauthorized" });
        }
        const decoded = await app.jwt.verify(token);
        request.user = decoded;
      } catch {
        return reply.code(401).send({ success: false, message: "Unauthorized" });
      }
    });

    await app.register(authRoutes);
    await app.ready();
  });

  it("1. Accepts explicit null for optional businessName and phone", () => {
    const input = {
      name: "Radha Raman",
      businessName: null,
      email: "radha@example.com",
      phone: null,
      password: "Password123!",
      confirmPassword: "Password123!",
    };
    const parsed = ownerRegisterSchema.safeParse(input);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.businessName).toBeNull();
      expect(parsed.data.phone).toBeNull();
      expect(parsed.data.name).toBe("Radha Raman");
    }
  });

  it("2. Accepts empty strings for optional businessName and phone and normalizes them to null", () => {
    const input = {
      name: "Radha Raman",
      businessName: "",
      email: "radha@example.com",
      phone: "",
      password: "Password123!",
      confirmPassword: "Password123!",
    };
    const parsed = ownerRegisterSchema.safeParse(input);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.businessName).toBeNull();
      expect(parsed.data.phone).toBeNull();
    }
  });

  it("3. Accepts omitted businessName and phone and defaults them to null", () => {
    const input = {
      name: "Radha Raman",
      email: "radha@example.com",
      password: "Password123!",
      confirmPassword: "Password123!",
    };
    const parsed = ownerRegisterSchema.safeParse(input);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.businessName).toBeNull();
      expect(parsed.data.phone).toBeNull();
    }
  });

  it("4. Validates strict Indian phone number when provided", () => {
    const valid = ownerRegisterSchema.safeParse({
      name: "Valid Phone",
      email: "vp@example.com",
      phone: "9876543210",
      password: "Password123!",
      confirmPassword: "Password123!",
    });
    expect(valid.success).toBe(true);

    const invalidDigits = ownerRegisterSchema.safeParse({
      name: "Invalid Phone",
      email: "ip@example.com",
      phone: "12345",
      password: "Password123!",
      confirmPassword: "Password123!",
    });
    expect(invalidDigits.success).toBe(false);

    const invalidLeadingDigit = ownerRegisterSchema.safeParse({
      name: "Invalid Leading",
      email: "il@example.com",
      phone: "5876543210",
      password: "Password123!",
      confirmPassword: "Password123!",
    });
    expect(invalidLeadingDigit.success).toBe(false);
  });

  it("5. Rejects password mismatch with field error on confirmPassword", () => {
    const mismatch = ownerRegisterSchema.safeParse({
      name: "Mismatch",
      email: "mismatch@example.com",
      password: "Password123!",
      confirmPassword: "DifferentPassword123!",
    });
    expect(mismatch.success).toBe(false);
    if (!mismatch.success) {
      const fieldErrors = mismatch.error.flatten().fieldErrors;
      expect(fieldErrors.confirmPassword).toContain("Passwords do not match");
    }
  });

  it("6. Fastify route returns 400 with structured fieldErrors when validation fails", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        name: "",
        email: "not-an-email",
        phone: "1234",
        password: "short",
        confirmPassword: "different",
      },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.errors).toBeDefined();
    expect(body.errors.name).toBeDefined();
    expect(body.errors.email).toBeDefined();
    expect(body.errors.phone).toBeDefined();
    expect(body.errors.password).toBeDefined();
    expect(body.errors.confirmPassword).toBeDefined();
  });

  it("7. Successfully registers owner with null businessName and phone via API", async () => {
    const uniqueEmail = `owner_null_${Date.now()}@example.com`;
    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        name: "Null Optional Owner",
        businessName: null,
        email: uniqueEmail,
        phone: null,
        password: "BoutiqueSecurePass2026!",
        confirmPassword: "BoutiqueSecurePass2026!",
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.email).toBe(uniqueEmail);
    expect(body.data.businessName).toBeNull();
    expect(body.data.phone).toBeNull();
  });

  it("8. Rejects duplicate email with 409 Conflict", async () => {
    const email = `dupe_email_${Date.now()}@example.com`;
    // Register first time
    const res1 = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        name: "First Instance",
        email,
        password: "BoutiqueSecurePass2026!",
        confirmPassword: "BoutiqueSecurePass2026!",
      },
    });
    expect(res1.statusCode).toBe(201);

    // Register second time with same email
    const res2 = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        name: "Second Instance",
        email,
        password: "BoutiqueSecurePass2026!",
        confirmPassword: "BoutiqueSecurePass2026!",
      },
    });
    expect(res2.statusCode).toBe(409);
    expect(res2.json().message).toBe("An owner with this email already exists.");
  });

  it("9. Rejects duplicate phone with 409 Conflict", async () => {
    const phone = `97${Math.floor(10000000 + Math.random() * 90000000)}`;
    const email1 = `dupe_phone1_${Date.now()}@example.com`;
    const email2 = `dupe_phone2_${Date.now()}@example.com`;

    const res1 = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        name: "Owner One Phone",
        email: email1,
        phone,
        password: "BoutiqueSecurePass2026!",
        confirmPassword: "BoutiqueSecurePass2026!",
      },
    });
    expect(res1.statusCode).toBe(201);

    const res2 = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        name: "Owner Two Phone",
        email: email2,
        phone,
        password: "BoutiqueSecurePass2026!",
        confirmPassword: "BoutiqueSecurePass2026!",
      },
    });
    expect(res2.statusCode).toBe(409);
    expect(res2.json().message).toBe("An owner with this phone number already exists.");
  });
});

