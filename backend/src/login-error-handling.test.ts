import { describe, it, expect, beforeAll, vi } from "vitest";
import { type FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { createServer } from "./app.js";
import { authService } from "./modules/auth/auth.service.js";
import prisma from "./lib/prisma.js";

describe("Login & Authentication Error Handling Security Verification", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createServer();
    await app.ready();
  });

  it("1. Successfully logs in with valid credentials (HTTP 200)", async () => {
    const spy = vi.spyOn(authService, "verifyOwnerCredentials").mockResolvedValueOnce({
      isAuthenticated: true,
      ownerId: 101,
      ownerName: "Anusha Boutique",
      email: "anusha@boutique.com",
      businessName: "Anusha Couture",
    });

    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email: "anusha@boutique.com",
        password: "ValidPassword123!",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.message).toBe("Logged in successfully");
    expect(body.data.id).toBe(101);
    expect(body.data.email).toBe("anusha@boutique.com");
    spy.mockRestore();
  });

  it("2. Returns exact required message for invalid credentials (HTTP 401)", async () => {
    const spy = vi.spyOn(authService, "verifyOwnerCredentials").mockResolvedValueOnce({
      isAuthenticated: false,
      ownerName: "Owner",
    });

    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email: "anusha@boutique.com",
        password: "WrongPassword123!",
      },
    });

    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.message).toBe("Incorrect email or password. Please try again.");
    spy.mockRestore();
  });

  it("3. Returns validation errors for invalid email or password format (HTTP 400)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email: "not-an-email",
        password: "short",
      },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.errors).toBeDefined();
    expect(body.errors.email || body.errors.password).toBeDefined();
  });

  it("4. Handles unexpected database / Prisma column error safely without leaking raw info (HTTP 500)", async () => {
    // Simulate Prisma throwing a missing column error (e.g. Owner.phone)
    const simulatedPrismaError = new Prisma.PrismaClientKnownRequestError(
      "The column `Owner.phone` does not exist in the current database.",
      {
        code: "P2022",
        clientVersion: "5.19.0",
      }
    );
    simulatedPrismaError.stack = "Error at /backend/src/modules/auth/auth.service.ts:233:36\n  in prisma.owner.findUnique";

    const spy = vi.spyOn(authService, "verifyOwnerCredentials").mockRejectedValueOnce(simulatedPrismaError);

    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email: "anusha@boutique.com",
        password: "ValidPassword123!",
      },
    });

    expect(res.statusCode).toBe(500);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.message).toBe(
      "We couldn't complete your sign-in right now. Please try again in a few moments. If the issue continues, contact support."
    );
    expect(body.refId).toBeDefined();
    expect(body.refId).toMatch(/^ERR-[A-Z0-9]+$/);

    // Verify zero leakage of Prisma, SQL, database column names, file paths, or stack traces
    const rawResponseBody = res.payload;
    expect(rawResponseBody).not.toContain("Prisma");
    expect(rawResponseBody).not.toContain("Owner.phone");
    expect(rawResponseBody).not.toContain("column");
    expect(rawResponseBody).not.toContain("P2022");
    expect(rawResponseBody).not.toContain("/backend/src");
    expect(rawResponseBody).not.toContain("stack");

    spy.mockRestore();
  });

  it("5. Handles unexpected database crash / connection loss safely on login (HTTP 500)", async () => {
    const connectionError = new Error("Can't reach database server at ep-autumn-grass-bd2ihwmj-pooler.c-8.us-east-2.aws.neon.tech:5432");
    connectionError.stack = "Error: Can't reach database server at postgresql://owner:secret123@ep-autumn-grass.../neondb";

    const spy = vi.spyOn(authService, "verifyOwnerCredentials").mockRejectedValueOnce(connectionError);

    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email: "anusha@boutique.com",
        password: "ValidPassword123!",
      },
    });

    expect(res.statusCode).toBe(500);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.message).toBe(
      "We couldn't complete your sign-in right now. Please try again in a few moments. If the issue continues, contact support."
    );
    expect(body.refId).toBeDefined();

    // Verify no credentials or connection details are exposed
    const rawResponseBody = res.payload;
    expect(rawResponseBody).not.toContain("ep-autumn-grass");
    expect(rawResponseBody).not.toContain("secret123");
    expect(rawResponseBody).not.toContain("neondb");
    expect(rawResponseBody).not.toContain("Can't reach database");

    spy.mockRestore();
  });

  it("6. Registration endpoint returns safe message and refId on database failure without leaking raw info", async () => {
    const dbError = new Error("Connection terminated unexpectedly in postgres transaction");
    const spy = vi.spyOn(authService, "registerOwner").mockRejectedValueOnce(dbError);

    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        name: "New Owner",
        email: "newowner@boutique.com",
        phone: "9876543210",
        businessName: "New Boutique",
        password: "ValidPassword123!",
        confirmPassword: "ValidPassword123!",
      },
    });

    expect(res.statusCode).toBe(500);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.message).toBe(
      "We couldn't complete your registration right now. Please try again in a few moments. If the issue continues, contact support."
    );
    expect(body.refId).toBeDefined();
    expect(body.refId).toMatch(/^ERR-[A-Z0-9]+$/);
    expect(res.payload).not.toContain("postgres");
    expect(res.payload).not.toContain("transaction");

    spy.mockRestore();
  });
});
