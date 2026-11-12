import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifyJwt from "@fastify/jwt";
import bcrypt from "bcrypt";
import {
  profileUpdateSchema,
  changePasswordSchema,
  orderCancelSchema,
  paginationQuerySchema,
} from "./lib/validation.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { authService } from "./modules/auth/auth.service.js";
import { customerRoutes } from "./modules/customers/customer.routes.js";
import { customerService } from "./modules/customers/customer.service.js";
import { orderRoutes } from "./modules/orders/order.routes.js";
import { orderService } from "./modules/orders/order.service.js";

describe("TASK 1 & TASK 4: Settings & Auth Endpoints & Schemas", () => {
  describe("Zod Validation Schemas", () => {
    it("profileUpdateSchema: accepts valid profile updates", () => {
      expect(profileUpdateSchema.safeParse({ name: "Ananya Boutique" }).success).toBe(true);
      expect(profileUpdateSchema.safeParse({ phone: "9876543210" }).success).toBe(true);
      expect(profileUpdateSchema.safeParse({ businessName: "Royal Silks" }).success).toBe(true);
      expect(
        profileUpdateSchema.safeParse({
          name: "Ananya Boutique",
          phone: "9876543210",
          businessName: "Royal Silks",
        }).success
      ).toBe(true);
    });

    it("profileUpdateSchema: rejects empty updates (at least one field required)", () => {
      const result = profileUpdateSchema.safeParse({});
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("At least one field");
      }
    });

    it("profileUpdateSchema: rejects invalid phone numbers", () => {
      expect(profileUpdateSchema.safeParse({ phone: "1234567890" }).success).toBe(false);
      expect(profileUpdateSchema.safeParse({ phone: "98765" }).success).toBe(false);
      expect(profileUpdateSchema.safeParse({ phone: "+919876543210" }).success).toBe(false);
    });

    it("changePasswordSchema: validates matching passwords and rejects same password", () => {
      const valid = changePasswordSchema.safeParse({
        currentPassword: "OldPassword123!",
        newPassword: "NewSecurePassword456!",
        confirmNewPassword: "NewSecurePassword456!",
      });
      expect(valid.success).toBe(true);

      const mismatched = changePasswordSchema.safeParse({
        currentPassword: "OldPassword123!",
        newPassword: "NewSecurePassword456!",
        confirmNewPassword: "DifferentPassword789!",
      });
      expect(mismatched.success).toBe(false);

      const identical = changePasswordSchema.safeParse({
        currentPassword: "SamePassword123!",
        newPassword: "SamePassword123!",
        confirmNewPassword: "SamePassword123!",
      });
      expect(identical.success).toBe(false);
      if (!identical.success) {
        expect(identical.error.issues[0]?.message).toContain("different from current password");
      }
    });

    it("orderCancelSchema: validates cancellation reason length", () => {
      expect(orderCancelSchema.safeParse({ reason: "Customer requested cancellation" }).success).toBe(true);
      expect(orderCancelSchema.safeParse({ reason: "" }).success).toBe(false);
      expect(orderCancelSchema.safeParse({ reason: "a".repeat(501) }).success).toBe(false);
    });

    it("paginationQuerySchema: supports archived parameter (true|false|all) defaulting to false", () => {
      const defaultVal = paginationQuerySchema.parse({});
      expect(defaultVal.archived).toBe("false");

      const trueVal = paginationQuerySchema.parse({ archived: "true" });
      expect(trueVal.archived).toBe("true");

      const falseVal = paginationQuerySchema.parse({ archived: "false" });
      expect(falseVal.archived).toBe("false");

      const allVal = paginationQuerySchema.parse({ archived: "all" });
      expect(allVal.archived).toBe("all");
    });
  });

  describe("Auth Routes Integration", () => {
    let app: FastifyInstance;
    let validToken: string;

    beforeAll(async () => {
      app = Fastify();
      await app.register(fastifyCookie);
      await app.register(fastifyJwt, {
        secret: "super_secret_test_jwt_key_at_least_32_characters_long",
        cookie: { cookieName: "token", signed: false },
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

      validToken = app.jwt.sign({
        ownerId: 42,
        role: "owner",
        email: "owner@test.com",
        name: "Test Owner",
        businessName: "Test Studio",
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("GET /auth/me: fetches fresh profile from DB by JWT ownerId", async () => {
      vi.spyOn(authService, "getOwnerProfile").mockResolvedValueOnce({
        id: 42,
        email: "fresh@test.com",
        name: "Fresh Owner Name",
        phone: "9876543210",
        businessName: "Fresh Boutique Name",
      });

      const res = await app.inject({
        method: "GET",
        url: "/auth/me",
        headers: { authorization: `Bearer ${validToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(42);
      expect(body.data.email).toBe("fresh@test.com");
      expect(body.data.name).toBe("Fresh Owner Name");
      expect(body.data.phone).toBe("9876543210");
      expect(body.data.businessName).toBe("Fresh Boutique Name");
      expect(body.data.role).toBe("owner");
    });

    it("PATCH /auth/profile: updates owner profile and derives ownerId from JWT", async () => {
      const updateSpy = vi.spyOn(authService, "updateProfile").mockResolvedValueOnce({
        status: "SUCCESS",
        owner: {
          id: 42,
          email: "owner@test.com",
          name: "Updated Name",
          phone: "9876543210",
          businessName: "Updated Business",
        },
      });

      const res = await app.inject({
        method: "PATCH",
        url: "/auth/profile",
        headers: { authorization: `Bearer ${validToken}` },
        payload: {
          name: "Updated Name",
          phone: "9876543210",
          businessName: "Updated Business",
          // Attempting to inject a different ownerId in body should be ignored
          ownerId: 999,
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
      expect(res.json().data.name).toBe("Updated Name");
      // Verify ownerId was derived from JWT (42), never from body (999)
      expect(updateSpy).toHaveBeenCalledWith({
        ownerId: 42,
        name: "Updated Name",
        phone: "9876543210",
        businessName: "Updated Business",
      });
    });

    it("PATCH /auth/profile: returns 409 on phone uniqueness conflict", async () => {
      vi.spyOn(authService, "updateProfile").mockResolvedValueOnce({
        status: "PHONE_EXISTS",
      });

      const res = await app.inject({
        method: "PATCH",
        url: "/auth/profile",
        headers: { authorization: `Bearer ${validToken}` },
        payload: { phone: "9876543210" },
      });

      expect(res.statusCode).toBe(409);
      expect(res.json().message).toContain("already exists");
    });

    it("PATCH /auth/change-password: returns 400 on incorrect current password", async () => {
      vi.spyOn(authService, "changePassword").mockResolvedValueOnce({
        status: "INVALID_CURRENT_PASSWORD",
      });

      const res = await app.inject({
        method: "PATCH",
        url: "/auth/change-password",
        headers: { authorization: `Bearer ${validToken}` },
        payload: {
          currentPassword: "WrongPassword123!",
          newPassword: "NewValidPassword456!",
          confirmNewPassword: "NewValidPassword456!",
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().message).toBe("Current password is incorrect");
    });

    it("PATCH /auth/change-password: on success clears token cookie and returns 200", async () => {
      vi.spyOn(authService, "changePassword").mockResolvedValueOnce({
        status: "SUCCESS",
      });

      const res = await app.inject({
        method: "PATCH",
        url: "/auth/change-password",
        headers: {
          authorization: `Bearer ${validToken}`,
          cookie: `token=${validToken}`,
        },
        payload: {
          currentPassword: "CorrectOldPassword123!",
          newPassword: "NewValidPassword456!",
          confirmNewPassword: "NewValidPassword456!",
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
      expect(res.json().message).toContain("Password changed successfully");
      const cookieHeader = String(res.headers["set-cookie"]);
      expect(cookieHeader).toContain("token=;");
    });
  });
});

describe("TASK 2: Customer Archival & Deletion", () => {
  let app: FastifyInstance;
  let validToken: string;

  beforeAll(async () => {
    app = Fastify();
    await app.register(fastifyCookie);
    await app.register(fastifyJwt, {
      secret: "super_secret_test_jwt_key_at_least_32_characters_long",
    });

    app.decorate("authenticateOwner", async (request: any, reply: any) => {
      const token = request.headers.authorization?.replace(/^Bearer\s+/, "");
      if (!token) return reply.code(401).send({ success: false });
      request.user = await app.jwt.verify(token);
    });

    await app.register(customerRoutes);
    validToken = app.jwt.sign({ ownerId: 10, role: "owner" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("PATCH /customers/:id/archive: marks customer as archived", async () => {
    const archiveSpy = vi.spyOn(customerService, "archiveCustomer").mockResolvedValueOnce({
      status: "SUCCESS",
      customer: {
        id: 5,
        name: "Archived Customer",
        phone: "9876543210",
        isArchived: true,
        archivedAt: new Date(),
        createdAt: new Date(),
      },
    });

    const res = await app.inject({
      method: "PATCH",
      url: "/customers/5/archive",
      headers: { authorization: `Bearer ${validToken}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.isArchived).toBe(true);
    expect(archiveSpy).toHaveBeenCalledWith(5, 10);
  });

  it("PATCH /customers/:id/restore: restores archived customer", async () => {
    const restoreSpy = vi.spyOn(customerService, "restoreCustomer").mockResolvedValueOnce({
      status: "SUCCESS",
      customer: {
        id: 5,
        name: "Restored Customer",
        phone: "9876543210",
        isArchived: false,
        archivedAt: null,
        createdAt: new Date(),
      },
    });

    const res = await app.inject({
      method: "PATCH",
      url: "/customers/5/restore",
      headers: { authorization: `Bearer ${validToken}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.isArchived).toBe(false);
    expect(restoreSpy).toHaveBeenCalledWith(5, 10);
  });

  it("DELETE /customers/:id: rejects with 409 if customer has existing orders", async () => {
    vi.spyOn(customerService, "deleteCustomer").mockResolvedValueOnce({
      status: "HAS_ORDERS",
    });

    const res = await app.inject({
      method: "DELETE",
      url: "/customers/5",
      headers: { authorization: `Bearer ${validToken}` },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().message).toBe("Customer has orders and cannot be deleted. Use archive instead.");
  });

  it("DELETE /customers/:id: allows deletion when customer has zero orders", async () => {
    vi.spyOn(customerService, "deleteCustomer").mockResolvedValueOnce({
      status: "SUCCESS",
    });

    const res = await app.inject({
      method: "DELETE",
      url: "/customers/5",
      headers: { authorization: `Bearer ${validToken}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().message).toContain("deleted successfully");
  });
});

describe("TASK 3: Order Cancellation & Archival", () => {
  let app: FastifyInstance;
  let validToken: string;

  beforeAll(async () => {
    app = Fastify();
    await app.register(fastifyCookie);
    await app.register(fastifyJwt, {
      secret: "super_secret_test_jwt_key_at_least_32_characters_long",
    });

    app.decorate("authenticateOwner", async (request: any, reply: any) => {
      const token = request.headers.authorization?.replace(/^Bearer\s+/, "");
      if (!token) return reply.code(401).send({ success: false });
      request.user = await app.jwt.verify(token);
    });

    await app.register(orderRoutes);
    validToken = app.jwt.sign({ ownerId: 10, role: "owner" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("PATCH /orders/:id/cancel: sets status=CANCELLED and preserves order data", async () => {
    const cancelSpy = vi.spyOn(orderService, "cancelOrder").mockResolvedValueOnce({
      status: "SUCCESS",
      order: {
        id: 7,
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelledBy: "owner",
        cancellationReason: "Client changed event date",
      },
    });

    const res = await app.inject({
      method: "PATCH",
      url: "/orders/7/cancel",
      headers: { authorization: `Bearer ${validToken}` },
      payload: { reason: "Client changed event date" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe("CANCELLED");
    expect(cancelSpy).toHaveBeenCalledWith(7, 10, "Client changed event date");
  });

  it("PATCH /orders/:id/cancel: rejects if order is already cancelled or archived", async () => {
    vi.spyOn(orderService, "cancelOrder").mockResolvedValueOnce({
      status: "CANNOT_CANCEL",
      message: "Order is already cancelled",
    });

    const res = await app.inject({
      method: "PATCH",
      url: "/orders/7/cancel",
      headers: { authorization: `Bearer ${validToken}` },
      payload: { reason: "Cancel again" },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().message).toBe("Order is already cancelled");
  });

  it("PATCH /orders/:id/archive: only allows archiving CANCELLED or PAID orders", async () => {
    vi.spyOn(orderService, "archiveOrder").mockResolvedValueOnce({
      status: "CANNOT_ARCHIVE",
      message: "Only CANCELLED or PAID orders can be archived",
    });

    const res = await app.inject({
      method: "PATCH",
      url: "/orders/7/archive",
      headers: { authorization: `Bearer ${validToken}` },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().message).toContain("Only CANCELLED or PAID orders can be archived");
  });

  it("PATCH /orders/:id/archive: succeeds for PAID or CANCELLED order", async () => {
    vi.spyOn(orderService, "archiveOrder").mockResolvedValueOnce({
      status: "SUCCESS",
      order: {
        id: 7,
        status: "ACTIVE",
        paymentStatus: "PAID",
        isArchived: true,
        archivedAt: new Date(),
      },
    });

    const res = await app.inject({
      method: "PATCH",
      url: "/orders/7/archive",
      headers: { authorization: `Bearer ${validToken}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.isArchived).toBe(true);
  });

  it("PATCH /orders/:id/restore: restores archived order", async () => {
    vi.spyOn(orderService, "restoreOrder").mockResolvedValueOnce({
      status: "SUCCESS",
      order: {
        id: 7,
        isArchived: false,
        archivedAt: null,
      },
    });

    const res = await app.inject({
      method: "PATCH",
      url: "/orders/7/restore",
      headers: { authorization: `Bearer ${validToken}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.isArchived).toBe(false);
  });
});

describe("SECURITY FIXES: CRITICAL-1, CRITICAL-2, CRITICAL-3", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("CRITICAL-3: Fallback auth is strictly disabled in production", async () => {
    const originalEnv = process.env.NODE_ENV;
    const originalEmail = process.env.OWNER_EMAIL;
    const originalPass = process.env.OWNER_PASSWORD;

    try {
      process.env.NODE_ENV = "production";
      process.env.OWNER_EMAIL = "owner@advancepay.com";
      process.env.OWNER_PASSWORD = "OwnerSecurePassword2026!";

      // Mock prisma.owner.findUnique to simulate no DB owner found
      const prismaModule = await import("./lib/prisma.js");
      vi.spyOn(prismaModule.default.owner, "findUnique").mockResolvedValue(null);

      const result = await authService.verifyOwnerCredentials(
        "owner@advancepay.com",
        "OwnerSecurePassword2026!"
      );

      // In production, fallback must NOT authenticate
      expect(result.isAuthenticated).toBe(false);
    } finally {
      process.env.NODE_ENV = originalEnv;
      process.env.OWNER_EMAIL = originalEmail;
      process.env.OWNER_PASSWORD = originalPass;
    }
  });

  it("CRITICAL-1 & CRITICAL-2: Verify payment routes scope order queries by authenticated ownerId", async () => {
    const fs = await import("fs");
    const paymentRoutesCode = fs.readFileSync("./src/modules/payments/payment.routes.ts", "utf8");

    // Verify POST /orders/:id/razorpay-order scopes by ownerId
    expect(paymentRoutesCode).toContain("where: { id: orderId, ownerId }");

    // Verify POST /orders/:id/reconcile scopes by ownerId
    expect(paymentRoutesCode).toContain("const order = await prisma.order.findFirst({\n        where: { id: orderId, ownerId },\n        include: {\n          payments: {");
  });
});

