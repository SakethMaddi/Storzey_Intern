import { describe, it, expect, beforeAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifyJwt from "@fastify/jwt";
import cors from "@fastify/cors";
import {
  customerSchema,
  customerUpdateSchema,
  numericIdParamSchema,
  publicTokenParamSchema,
  orderCreateSchema,
  orderStageCreateSchema,
  razorpayOrderRequestSchema,
  paginationQuerySchema,
  loginSchema,
  ownerRegisterSchema,
} from "./lib/validation.js";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";

describe("New Features: Customer Edit, Expiration & Custom Stages", () => {
  let app: FastifyInstance;

  // Mock state
  let mockCustomers = [
    { id: 1, name: "Pooja Sharma", phone: "9876543210" },
    { id: 2, name: "Ananya Patel", phone: "8765432109" },
  ];

  let mockOrders: Array<{
    id: number;
    publicToken: string;
    itemName: string;
    totalAmount: number;
    advance: number;
    balance: number;
    paymentStatus: string;
    customerId: number;
    paymentLinkExpiresAt: Date | null;
    stages: Array<{ id: number; name: string; position: number; status: string }>;
  }> = [];

  beforeAll(async () => {
    app = Fastify();

    // Register CORS with dynamic origin matching server.ts
    const defaultAllowedOrigins = [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "https://advancepay-production.vercel.app",
    ];
    const allowedOriginsSet = new Set(defaultAllowedOrigins);

    await app.register(cors, {
      origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        const normalized = origin.replace(/\/+$/, "");
        if (allowedOriginsSet.has(normalized)) return cb(null, true);
        return cb(new Error("CORS rejection"), false);
      },
      credentials: true,
    });
    await app.register(fastifyCookie);
    await app.register(fastifyJwt, {
      secret: "test_secret_key_1234567890",
      cookie: { cookieName: "token", signed: false },
    });

    app.decorate("authenticateOwner", async (request: any, reply: any) => {
      const token =
        request.cookies?.token ||
        request.headers.authorization?.replace(/^Bearer\s+/, "");
      if (!token) {
        return reply.code(401).send({
          success: false,
          message: "Unauthorized. Authentication is required to access owner features.",
        });
      }
      try {
        const decoded = await app.jwt.verify(token);
        request.user = decoded;
      } catch {
        return reply.code(401).send({
          success: false,
          message: "Session expired or invalid token.",
        });
      }
    });

    // PATCH /customers/:id
    app.patch(
      "/customers/:id",
      { preHandler: [(app as any).authenticateOwner] },
      async (req, reply) => {
        const paramResult = numericIdParamSchema.safeParse(req.params);
        if (!paramResult.success) {
          return reply.code(400).send({ success: false, message: "Invalid customer ID" });
        }
        const bodyResult = customerUpdateSchema.safeParse(req.body);
        if (!bodyResult.success) {
          return reply.code(400).send({
            success: false,
            message: bodyResult.error.issues[0]?.message,
          });
        }
        const { id } = paramResult.data;
        const { name, phone } = bodyResult.data;

        const cust = mockCustomers.find((c) => c.id === id);
        if (!cust) {
          return reply.code(404).send({ success: false, message: "Customer not found" });
        }

        const duplicate = mockCustomers.find((c) => c.phone === phone && c.id !== id);
        if (duplicate) {
          return reply.code(409).send({
            success: false,
            message: `A customer with phone number ${phone} already exists (${duplicate.name})`,
          });
        }

        cust.name = name;
        cust.phone = phone;
        return reply.send({ success: true, data: cust });
      }
    );

    // POST /orders
    app.post(
      "/orders",
      { preHandler: [(app as any).authenticateOwner] },
      async (req, reply) => {
        const parsed = orderCreateSchema.safeParse(req.body);
        if (!parsed.success) {
          return reply.code(400).send({
            success: false,
            message: parsed.error.issues[0]?.message,
          });
        }
        const { itemName, totalAmount, advance, customerId, stages } = parsed.data;

        const defaultStages = ["Measurements", "Cutting", "Embroidery", "Trial", "Ready"];
        const finalStages = stages && stages.length > 0 ? stages : defaultStages;

        const newOrder = {
          id: mockOrders.length + 1,
          publicToken: `token-order-${mockOrders.length + 1}`,
          itemName,
          totalAmount,
          advance,
          balance: totalAmount,
          paymentStatus: "PENDING",
          customerId,
          paymentLinkExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          stages: finalStages.map((name, i) => ({
            id: i + 1,
            name,
            position: i,
            status: "PENDING",
          })),
        };
        mockOrders.push(newOrder);

        return reply.code(201).send({ success: true, data: newOrder });
      }
    );

    // Protected numeric order payment route (Owner-only)
    app.post("/orders/:id/razorpay-order", { preHandler: [(app as any).authenticateOwner] }, async (req, reply) => {
      const orderId = Number((req.params as any).id);
      const order = mockOrders.find((o) => o.id === orderId);
      if (!order) {
        return reply.code(404).send({ success: false, message: "Order not found" });
      }
      return reply.send({ success: true, message: "Owner initiated payment" });
    });

    // Public payment creation by secure publicToken
    app.post("/api/public/orders/:token/razorpay-order", async (req, reply) => {
      const paramResult = publicTokenParamSchema.safeParse(req.params);
      if (!paramResult.success) {
        return reply.code(400).send({ success: false, message: "Invalid order tracking token" });
      }
      const bodyResult = razorpayOrderRequestSchema.safeParse(req.body);
      if (!bodyResult.success) {
        return reply.code(400).send({ success: false, message: "Invalid payment type" });
      }
      const { token } = paramResult.data;
      const { paymentType } = bodyResult.data;

      const order = mockOrders.find((o) => o.publicToken === token);
      if (!order) {
        return reply.code(404).send({ success: false, message: "Order not found" });
      }

      if (order.paymentLinkExpiresAt && new Date(order.paymentLinkExpiresAt).getTime() < Date.now()) {
        return reply.code(400).send({
          success: false,
          message: "Payment link has expired. New payment attempts are not accepted for this order.",
        });
      }

      if (order.balance <= 0) {
        return reply.code(400).send({ success: false, message: "Order is already fully paid" });
      }

      return reply.send({
        success: true,
        message: "Razorpay order created",
        data: { orderId: order.id, amount: order.balance * 100 },
      });
    });

    // Verification simulation checking expiration
    app.post("/payments/verify", async (req, reply) => {
      const { orderId } = req.body as any;
      const order = mockOrders.find((o) => o.id === orderId);
      if (!order) {
        return reply.code(404).send({ success: false, message: "Order not found" });
      }

      if (order.paymentLinkExpiresAt && new Date(order.paymentLinkExpiresAt).getTime() < Date.now()) {
        return reply.code(400).send({
          success: false,
          message: "Payment link has expired. New payment attempts are not accepted for this order.",
        });
      }

      return reply.send({ success: true, message: "Payment verified successfully" });
    });
  });

  const getOwnerAuthHeaders = () => {
    const token = app.jwt.sign({ role: "owner", email: "owner@advancepay.com" }, { expiresIn: "1h" });
    return { authorization: `Bearer ${token}` };
  };

  // 1. Customer Editing Tests
  it("Customer Edit: Rejects unauthenticated patch", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/customers/1",
      payload: { name: "Pooja S", phone: "9876543210" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("Customer Edit: Successfully updates name and phone with valid Indian number", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/customers/1",
      headers: getOwnerAuthHeaders(),
      payload: { name: "Pooja Sharma Rao", phone: "9876543211" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.name).toBe("Pooja Sharma Rao");
    expect(res.json().data.phone).toBe("9876543211");
  });

  it("Customer Edit: Rejects invalid phone numbers (starts with 5, letters, wrong length)", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/customers/1",
      headers: getOwnerAuthHeaders(),
      payload: { name: "Pooja", phone: "5876543210" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toContain("must start with 6, 7, 8, or 9");
  });

  it("Customer Edit: Rejects duplicate phone number belonging to another customer with 409", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/customers/1",
      headers: getOwnerAuthHeaders(),
      payload: { name: "Pooja", phone: "8765432109" }, // Belongs to customer 2
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().message).toContain("already exists");
  });

  it("Customer Edit: Handles nonexistent customer ID with 404", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/customers/999",
      headers: getOwnerAuthHeaders(),
      payload: { name: "Nonexistent", phone: "9999888877" },
    });
    expect(res.statusCode).toBe(404);
  });

  // 2. Custom Production Stages Tests
  it("Custom Stages: Creates order with default stages when none supplied", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/orders",
      headers: getOwnerAuthHeaders(),
      payload: {
        itemName: "Silk Saree Blouse",
        totalAmount: 15000,
        advance: 5000,
        customerId: 1,
        promisedDate: "2026-12-25",
      },
    });
    expect(res.statusCode).toBe(201);
    const stages = res.json().data.stages;
    expect(stages.length).toBe(5);
    expect(stages[0].name).toBe("Measurements");
    expect(stages[4].name).toBe("Ready");
  });

  it("Custom Stages: Creates order with custom reordered stages and positions", async () => {
    const customList = ["Fabric Sourcing", "Hand Embroidery", "Fitting Trial", "Final Pressing"];
    const res = await app.inject({
      method: "POST",
      url: "/orders",
      headers: getOwnerAuthHeaders(),
      payload: {
        itemName: "Bridal Lehenga",
        totalAmount: 45000,
        advance: 20000,
        customerId: 1,
        promisedDate: "2026-12-30",
        stages: customList,
      },
    });
    expect(res.statusCode).toBe(201);
    const stages = res.json().data.stages;
    expect(stages.length).toBe(4);
    expect(stages[0].name).toBe("Fabric Sourcing");
    expect(stages[0].position).toBe(0);
    expect(stages[1].name).toBe("Hand Embroidery");
    expect(stages[1].position).toBe(1);
  });

  it("Custom Stages: Rejects duplicate stage names within the same order", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/orders",
      headers: getOwnerAuthHeaders(),
      payload: {
        itemName: "Bridal Lehenga",
        totalAmount: 45000,
        advance: 20000,
        customerId: 1,
        promisedDate: "2026-12-30",
        stages: ["Cutting", "Embroidery", "cutting"],
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toContain("Duplicate stage names are not allowed");
  });

  it("Custom Stages: Rejects more than 15 stages", async () => {
    const tooMany = Array.from({ length: 16 }, (_, i) => `Stage ${i + 1}`);
    const res = await app.inject({
      method: "POST",
      url: "/orders",
      headers: getOwnerAuthHeaders(),
      payload: {
        itemName: "Bridal Lehenga",
        totalAmount: 45000,
        advance: 20000,
        customerId: 1,
        promisedDate: "2026-12-30",
        stages: tooMany,
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toContain("Cannot have more than 15 stages");
  });

  // 3. Payment Link Expiration & Public Token Tests
  it("Payment Expiration: Active payment link allows payment initiation via public token", async () => {
    // Order 1 is active (expires in 7 days)
    const res = await app.inject({
      method: "POST",
      url: "/api/public/orders/token-order-1/razorpay-order",
      payload: { paymentType: "ADVANCE" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
    expect(res.json().data.orderId).toBe(1);
  });

  it("Payment Security: Rejects payment initiation for unknown token", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/public/orders/non-existent-token/razorpay-order",
      payload: { paymentType: "ADVANCE" },
    });
    expect(res.statusCode).toBe(404);
  });

  it("Payment Security: Prevents unauthenticated public access to old numeric-ID endpoint", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/orders/1/razorpay-order",
      payload: { paymentType: "ADVANCE" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("Payment Expiration: Expired payment link rejects Razorpay payment creation with 400", async () => {
    // Force order 1 expiration date to past
    const ord = mockOrders.find((o) => o.id === 1);
    if (ord) ord.paymentLinkExpiresAt = new Date(Date.now() - 1000 * 60 * 60 * 24); // expired 1 day ago

    const res = await app.inject({
      method: "POST",
      url: "/api/public/orders/token-order-1/razorpay-order",
      payload: { paymentType: "ADVANCE" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toContain("Payment link has expired");
  });

  it("Payment Expiration: Expired payment link rejects verification of new payment attempts", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/payments/verify",
      payload: { orderId: 1 },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toContain("Payment link has expired");
  });

  it("Payment Expiration: Existing orders without an expiration date remain payable", async () => {
    const ord = mockOrders.find((o) => o.id === 2);
    if (ord) ord.paymentLinkExpiresAt = null; // Legacy order with no expiration date

    const res = await app.inject({
      method: "POST",
      url: "/api/public/orders/token-order-2/razorpay-order",
      payload: { paymentType: "ADVANCE" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
  });

  // 4. Dynamic CORS Tests
  it("CORS: Allows trusted production origin", async () => {
    const res = await app.inject({
      method: "OPTIONS",
      url: "/customers/1",
      headers: {
        origin: "https://advancepay-production.vercel.app",
        "access-control-request-method": "GET",
      },
    });
    expect(res.statusCode).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe("https://advancepay-production.vercel.app");
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("CORS: Rejects untrusted attacker origin", async () => {
    const res = await app.inject({
      method: "OPTIONS",
      url: "/customers/1",
      headers: {
        origin: "https://malicious-attacker.com",
        "access-control-request-method": "GET",
      },
    });
    expect(res.statusCode).toBe(500);
  });

  // 5. HIGH-2: Pagination and Query Validation Tests
  describe("HIGH-2: Pagination Validation and Bounded Limits", () => {
    it("Pagination: Validates default page and limit", () => {
      const parsed = paginationQuerySchema.safeParse({});
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.page).toBe(1);
        expect(parsed.data.limit).toBe(50);
      }
    });

    it("Pagination: Accepts custom page and limit within bounds", () => {
      const parsed = paginationQuerySchema.safeParse({ page: "3", limit: "25" });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.page).toBe(3);
        expect(parsed.data.limit).toBe(25);
      }
    });

    it("Pagination: Rejects limit exceeding 100", () => {
      const parsed = paginationQuerySchema.safeParse({ limit: "150" });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0]?.message).toContain("Limit cannot exceed 100");
      }
    });

    it("Pagination: Rejects page less than 1", () => {
      const parsed = paginationQuerySchema.safeParse({ page: "0" });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0]?.message).toContain("Page must be at least 1");
      }
    });

    it("Pagination: Rejects negative limit or page", () => {
      const parsed = paginationQuerySchema.safeParse({ page: "-1", limit: "-10" });
      expect(parsed.success).toBe(false);
    });

    it("Pagination: Parses search and status query parameters correctly", () => {
      const parsed = paginationQuerySchema.safeParse({
        page: "2",
        limit: "10",
        search: "Silk Saree",
        status: "PENDING",
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.search).toBe("Silk Saree");
        expect(parsed.data.status).toBe("PENDING");
      }
    });
  });

  // 6. HIGH-3: Centralized Fastify Error Handler and Redaction Tests
  describe("HIGH-3: Centralized Error Handler and Pino Redaction", () => {
    let errorApp: FastifyInstance;

    beforeAll(async () => {
      errorApp = Fastify({
        logger: {
          redact: [
            "req.headers.authorization",
            "req.headers.cookie",
            'req.headers["x-razorpay-signature"]',
            "req.body.password",
            "req.body.confirmPassword",
          ],
        },
      });

      errorApp.setErrorHandler((error: any, request, reply) => {
        if (error instanceof ZodError) {
          return reply.code(400).send({
            success: false,
            message: error.issues[0]?.message || "Validation failed",
            errors: error.flatten().fieldErrors,
          });
        }
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          if (error.code === "P2002") {
            return reply.code(409).send({
              success: false,
              message: "A resource with these unique details already exists",
            });
          }
          if (error.code === "P2025") {
            return reply.code(404).send({
              success: false,
              message: "Requested resource not found",
            });
          }
        }
        if (typeof error.statusCode === "number" && error.statusCode >= 400 && error.statusCode < 500) {
          return reply.code(error.statusCode).send({
            success: false,
            message: error.message || "Bad Request",
          });
        }
        request.log.error(error);
        const isProd = process.env.NODE_ENV === "production";
        return reply.code(500).send({
          success: false,
          message: isProd ? "Internal server error" : (error.message || "Internal server error"),
        });
      });

      errorApp.get("/test-500", async () => {
        throw new Error("Sensitive database table failure: user credentials corrupted");
      });

      errorApp.get("/test-prisma-p2002", async () => {
        const prismaErr = new Prisma.PrismaClientKnownRequestError("Unique constraint", {
          code: "P2002",
          clientVersion: "7.10.1",
        });
        throw prismaErr;
      });

      errorApp.get("/test-prisma-p2025", async () => {
        const prismaErr = new Prisma.PrismaClientKnownRequestError("Record not found", {
          code: "P2025",
          clientVersion: "7.10.1",
        });
        throw prismaErr;
      });

      errorApp.post("/test-zod", async (req) => {
        orderCreateSchema.parse(req.body);
        return { success: true };
      });

      errorApp.get("/test-fastify-404", async (_, reply) => {
        return reply.code(404).send({ success: false, message: "Custom 404 message" });
      });
    });

    it("ErrorHandler: Unexpected error in production hides internal message and returns 500", async () => {
      const origEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = "production";
        const res = await errorApp.inject({ method: "GET", url: "/test-500" });
        expect(res.statusCode).toBe(500);
        const body = res.json();
        expect(body.success).toBe(false);
        expect(body.message).toBe("Internal server error");
        expect(JSON.stringify(body)).not.toContain("Sensitive database table failure");
      } finally {
        process.env.NODE_ENV = origEnv;
      }
    });

    it("ErrorHandler: Maps Prisma P2002 to HTTP 409", async () => {
      const res = await errorApp.inject({ method: "GET", url: "/test-prisma-p2002" });
      expect(res.statusCode).toBe(409);
      expect(res.json().success).toBe(false);
      expect(res.json().message).toContain("already exists");
    });

    it("ErrorHandler: Maps Prisma P2025 to HTTP 404", async () => {
      const res = await errorApp.inject({ method: "GET", url: "/test-prisma-p2025" });
      expect(res.statusCode).toBe(404);
      expect(res.json().success).toBe(false);
      expect(res.json().message).toContain("not found");
    });

    it("ErrorHandler: Maps Zod validation error to HTTP 400 with flattened fieldErrors", async () => {
      const res = await errorApp.inject({ method: "POST", url: "/test-zod", payload: {} });
      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.errors).toBeDefined();
      expect(typeof body.errors).toBe("object");
    });

    it("ErrorHandler: Preserves explicit HTTP client status codes", async () => {
      const res = await errorApp.inject({ method: "GET", url: "/test-fastify-404" });
      expect(res.statusCode).toBe(404);
      expect(res.json().message).toBe("Custom 404 message");
    });

    it("Redaction: Pino redacts both nested req.* and root-level sensitive fields", async () => {
      const logs: string[] = [];
      const testLoggerApp = Fastify({
        logger: {
          stream: {
            write(chunk: string) {
              logs.push(chunk);
              return true;
            },
          } as any,
          redact: [
            "req.headers.authorization",
            "req.headers.cookie",
            'req.headers["x-razorpay-signature"]',
            "req.body.password",
            "req.body.confirmPassword",
            "headers.authorization",
            "headers.cookie",
            'headers["x-razorpay-signature"]',
            "body.password",
            "body.confirmPassword",
            "authorization",
            "cookie",
            "password",
            "confirmPassword",
          ],
        },
      });

      testLoggerApp.post("/log-test", async (request) => {
        // Log sensitive dummy fields at root, body, and headers levels
        request.log.info({ password: "RootSecretPassword999!" }, "Root log");
        request.log.info({ body: { password: "BodySecretPassword888!" } }, "Body log");
        request.log.info({ headers: { authorization: "Bearer RootSecretJwtToken777" } }, "Headers log");
        return { ok: true };
      });

      await testLoggerApp.ready();
      await testLoggerApp.inject({
        method: "POST",
        url: "/log-test",
        headers: {
          authorization: "Bearer InjectedReqJwtToken666",
          cookie: "token=InjectedCookie555",
          "x-razorpay-signature": "InjectedRazorpaySig444",
        },
        payload: {
          password: "InjectedPassword333!",
          confirmPassword: "InjectedConfirmPassword222!",
        },
      });

      const fullOutput = logs.join("");
      // Verify no sensitive dummy value is emitted in plaintext
      expect(fullOutput).not.toContain("RootSecretPassword999!");
      expect(fullOutput).not.toContain("BodySecretPassword888!");
      expect(fullOutput).not.toContain("RootSecretJwtToken777");
      expect(fullOutput).not.toContain("InjectedReqJwtToken666");
      expect(fullOutput).not.toContain("InjectedCookie555");
      expect(fullOutput).not.toContain("InjectedRazorpaySig444");
      expect(fullOutput).not.toContain("InjectedPassword333!");
      expect(fullOutput).not.toContain("InjectedConfirmPassword222!");
    });

    it("ErrorHandler: Sanitizes database URLs in unexpected error messages logged internally", async () => {
      let loggedError: any = null;
      const testSanitizeApp = Fastify();

      function sanitizeSecretStrings(text: string): string {
        return text
          .replace(/postgres(?:ql)?:\/\/([^:]+):([^@]+)@/gi, "postgres://$1:[REDACTED]@")
          .replace(/(Bearer\s+)[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/gi, "$1[REDACTED]")
          .replace(/(rzp_(?:live|test)_[A-Za-z0-9]+)/gi, "[REDACTED_RAZORPAY_KEY]");
      }

      testSanitizeApp.setErrorHandler((error: any, request, reply) => {
        if (error instanceof Error) {
          const sanitized = new Error(sanitizeSecretStrings(error.message));
          sanitized.name = sanitizeSecretStrings(error.name || "Error");
          if (error.stack) {
            sanitized.stack = sanitizeSecretStrings(error.stack);
          }
          loggedError = sanitized;
        }
        return reply.code(500).send({ success: false, message: "Internal server error" });
      });

      testSanitizeApp.get("/db-fail", async () => {
        throw new Error("Unable to connect to postgresql://admin:SuperSecretDatabasePassword@ep-cool.neon.tech/main?sslmode=require");
      });

      await testSanitizeApp.ready();
      const res = await testSanitizeApp.inject({ method: "GET", url: "/db-fail" });
      expect(res.statusCode).toBe(500);
      expect(loggedError).toBeDefined();
      expect(loggedError.message).not.toContain("SuperSecretDatabasePassword");
      expect(loggedError.message).toContain("postgres://admin:[REDACTED]@ep-cool.neon.tech/main");
      if (loggedError.stack) {
        expect(loggedError.stack).not.toContain("SuperSecretDatabasePassword");
      }
    });

    it("ErrorHandler: Safe handling of non-Error objects and Errors with sensitive causes", async () => {
      const logs: string[] = [];
      const testSafeApp = Fastify({
        logger: {
          stream: {
            write(chunk: string) {
              logs.push(chunk);
              return true;
            },
          } as any,
        },
      });

      function sanitizeSecretStrings(text: string): string {
        return text
          .replace(/postgres(?:ql)?:\/\/([^:]+):([^@]+)@/gi, "postgres://$1:[REDACTED]@")
          .replace(/(Bearer\s+)[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/gi, "$1[REDACTED]")
          .replace(/(rzp_(?:live|test)_[A-Za-z0-9]+)/gi, "[REDACTED_RAZORPAY_KEY]");
      }

      testSafeApp.setErrorHandler((error: any, request, reply) => {
        if (error instanceof Error) {
          const sanitizedError = new Error(sanitizeSecretStrings(error.message));
          sanitizedError.name = sanitizeSecretStrings(error.name || "Error");
          if (error.stack) {
            sanitizedError.stack = sanitizeSecretStrings(error.stack);
          }
          request.log.error(sanitizedError);
        } else {
          request.log.error(
            {
              errorType: typeof error,
              isNonNullObject: error !== null && typeof error === "object",
              isArray: Array.isArray(error),
            },
            "Non-Error value rejected by server"
          );
        }

        const isProd = process.env.NODE_ENV === "production";
        return reply.code(500).send({
          success: false,
          message: isProd ? "Internal server error" : (error.message || "Internal server error"),
        });
      });

      testSafeApp.get("/error-with-cause", async () => {
        const sensitiveCause = new Error("Underlying error with postgres://secret_user:SecretCausePass999@db.neon.tech/main");
        const outerErr = new Error("High level operation failed", { cause: sensitiveCause });
        throw outerErr;
      });

      testSafeApp.get("/non-error-thrown", async () => {
        throw {
          customerSecretToken: "token_dummy_xyz123",
          nestedCardDetails: { cvv: "123", dummyPass: "NonErrorSecretPass888" },
        };
      });

      await testSafeApp.ready();

      const origEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = "production";

        // 1. Error with sensitive cause
        const resCause = await testSafeApp.inject({ method: "GET", url: "/error-with-cause" });
        expect(resCause.statusCode).toBe(500);
        expect(resCause.json()).toEqual({ success: false, message: "Internal server error" });

        // 2. Non-Error thrown object
        const resNonError = await testSafeApp.inject({ method: "GET", url: "/non-error-thrown" });
        expect(resNonError.statusCode).toBe(500);
        expect(resNonError.json()).toEqual({ success: false, message: "Internal server error" });

        // 3. Inspect emitted logs: neither secret cause nor raw thrown object properties leaked
        const allEmittedLogs = logs.join("");
        expect(allEmittedLogs).not.toContain("SecretCausePass999");
        expect(allEmittedLogs).not.toContain("token_dummy_xyz123");
        expect(allEmittedLogs).not.toContain("NonErrorSecretPass888");
        expect(allEmittedLogs).toContain("Non-Error value rejected by server");
        expect(allEmittedLogs).toContain('"errorType":"object"');
      } finally {
        process.env.NODE_ENV = origEnv;
      }
    });

    it("RateLimit: Enforces HTTP 429 when route rate limit is exceeded with proper headers", async () => {
      const rateLimitModule = await import("@fastify/rate-limit");
      const fastifyRateLimit = rateLimitModule.default || rateLimitModule;

      const testRLApp = Fastify();
      await testRLApp.register(fastifyRateLimit, {
        global: true,
        max: 5,
        timeWindow: 60 * 1000,
        allowList: (req) => {
          if (req.method !== "POST") return false;
          const path = req.url.split("?")[0];
          return path === "/webhooks/razorpay";
        },
        errorResponseBuilder: (_req, context) => ({
          statusCode: 429,
          error: "Too Many Requests",
          message: `Rate limit exceeded, retry in ${context.after}`,
          success: false,
        }),
      });

      testRLApp.setErrorHandler((error: any, request, reply) => {
        if (typeof error.statusCode === "number" && error.statusCode >= 400 && error.statusCode < 500) {
          return reply.code(error.statusCode).send({
            success: false,
            message: error.message || "Bad Request",
          });
        }
        return reply.code(500).send({ success: false, message: "Internal server error" });
      });

      // Strict route: max 2 requests
      testRLApp.post(
        "/auth/login-test",
        {
          config: {
            rateLimit: {
              max: 2,
              timeWindow: 15 * 60 * 1000,
            },
          },
        },
        async () => ({ success: true })
      );

      // Webhook route: exempt
      testRLApp.post("/webhooks/razorpay", async () => ({ success: true }));
      // Non-exempt webhook routes or methods:
      testRLApp.get("/webhooks/razorpay", async () => ({ success: true }));
      testRLApp.post("/api/webhooks/razorpay", async () => ({ success: true }));
      testRLApp.post("/webhooks/other", async () => ({ success: true }));

      await testRLApp.ready();

      // 1. Route-specific limit overrides global limit (max 2 vs global max 5)
      const res1 = await testRLApp.inject({
        method: "POST",
        url: "/auth/login-test",
        remoteAddress: "192.168.1.1",
      });
      expect(res1.statusCode).toBe(200);
      expect(Number(res1.headers["x-ratelimit-limit"])).toBe(2);
      expect(Number(res1.headers["x-ratelimit-remaining"])).toBe(1);

      const res2 = await testRLApp.inject({
        method: "POST",
        url: "/auth/login-test",
        remoteAddress: "192.168.1.1",
      });
      expect(res2.statusCode).toBe(200);
      expect(Number(res2.headers["x-ratelimit-remaining"])).toBe(0);

      // 2. 3rd request from same IP is blocked with HTTP 429
      const res3 = await testRLApp.inject({
        method: "POST",
        url: "/auth/login-test",
        remoteAddress: "192.168.1.1",
      });
      expect(res3.statusCode).toBe(429);
      const body3 = res3.json();
      expect(body3.success).toBe(false);
      expect(body3.message).toContain("Rate limit exceeded, retry in");
      expect(res3.headers["retry-after"]).toBeDefined();

      // 3. Different client IP has its own separate counter and succeeds
      const resDiffIp = await testRLApp.inject({
        method: "POST",
        url: "/auth/login-test",
        remoteAddress: "192.168.1.2",
      });
      expect(resDiffIp.statusCode).toBe(200);
      expect(Number(resDiffIp.headers["x-ratelimit-remaining"])).toBe(1);

      // 4. Exact Razorpay POST webhook is exempt (even with query strings)
      for (let i = 0; i < 15; i++) {
        const whRes = await testRLApp.inject({
          method: "POST",
          url: "/webhooks/razorpay?signature=test123",
          remoteAddress: "10.0.0.99",
        });
        expect(whRes.statusCode).toBe(200);
      }

      // 5. GET /webhooks/razorpay is NOT exempt (falls under global limit of 5)
      for (let i = 0; i < 5; i++) {
        const getRes = await testRLApp.inject({
          method: "GET",
          url: "/webhooks/razorpay",
          remoteAddress: "10.0.0.101",
        });
        expect(getRes.statusCode).toBe(200);
      }
      const getBlocked = await testRLApp.inject({
        method: "GET",
        url: "/webhooks/razorpay",
        remoteAddress: "10.0.0.101",
      });
      expect(getBlocked.statusCode).toBe(429);

      // 6. POST /api/webhooks/razorpay is the old wrong path and is NOT exempt
      for (let i = 0; i < 5; i++) {
        const otherRes = await testRLApp.inject({
          method: "POST",
          url: "/api/webhooks/razorpay",
          remoteAddress: "10.0.0.102",
        });
        expect(otherRes.statusCode).toBe(200);
      }
      const otherBlocked = await testRLApp.inject({
        method: "POST",
        url: "/api/webhooks/razorpay",
        remoteAddress: "10.0.0.102",
      });
      expect(otherBlocked.statusCode).toBe(429);
    });

    it("RateLimit: trusts one Railway hop and ignores unsigned client IP headers", { timeout: 15000 }, async () => {
      const { createServer } = await import("./app.js");
      const originalSecret = process.env.PROXY_SHARED_SECRET;
      delete process.env.PROXY_SHARED_SECRET;

      const prodEnv = {
        DATABASE_URL: "postgresql://user:pass@ep-host.neon.tech/dbname?sslmode=require",
        JWT_SECRET: "super_secure_jwt_secret_with_more_than_32_characters_for_prod",
        FRONTEND_URL: "https://advancepay.example.com",
        CORS_ORIGIN: "https://advancepay.example.com",
        RAZORPAY_KEY_ID: "rzp_test_1234567890abcdef",
        RAZORPAY_KEY_SECRET: "sec_test_1234567890abcdef",
        RAZORPAY_WEBHOOK_SECRET: "whsec_1234567890abcdef",
        PORT: 5001,
        NODE_ENV: "production",
        isProduction: true,
      };

      const devEnv = {
        ...prodEnv,
        NODE_ENV: "development",
        isProduction: false,
      };

      try {
        const prodApp = await createServer(prodEnv);
        const devApp = await createServer(devEnv);
        const probeConfig = {
          config: { rateLimit: { max: 2, timeWindow: 60 * 1000 } },
        };
        prodApp.get("/__probe", probeConfig, async (request) => ({ ip: request.ip }));
        devApp.get("/__probe", probeConfig, async (request) => ({ ip: request.ip }));

        const forwarded = await prodApp.inject({
          method: "GET",
          url: "/__probe",
          remoteAddress: "10.0.0.1",
          headers: { "x-forwarded-for": "198.51.100.25", "x-real-ip": "203.0.113.9" },
        });
        expect(forwarded.statusCode).toBe(200);
        expect(forwarded.json().ip).toBe("198.51.100.25");

        const spoofed = await prodApp.inject({
          method: "GET",
          url: "/__probe",
          remoteAddress: "10.0.0.1",
          headers: { "x-forwarded-for": "1.2.3.4, 198.51.100.25" },
        });
        expect(spoofed.json().ip).toBe("198.51.100.25");

        const realIpIgnored = await prodApp.inject({
          method: "GET",
          url: "/__probe",
          remoteAddress: "10.0.0.8",
          headers: { "x-real-ip": "198.51.100.77" },
        });
        expect(realIpIgnored.json().ip).toBe("10.0.0.8");

        const blocked = await prodApp.inject({
          method: "GET",
          url: "/__probe",
          remoteAddress: "10.0.0.1",
          headers: { "x-forwarded-for": "198.51.100.25", "x-real-ip": "203.0.113.50" },
        });
        expect(blocked.statusCode).toBe(429);

        process.env.PROXY_SHARED_SECRET = "proxy-shared-secret-for-tests";
        const proxied = await prodApp.inject({
          method: "GET",
          url: "/__probe",
          remoteAddress: "10.0.0.1",
          headers: {
            "x-forwarded-for": "198.51.100.25",
            "x-advancepay-proxy-token": "proxy-shared-secret-for-tests",
            "x-advancepay-client-ip": "203.0.113.10",
          },
        });
        expect(proxied.statusCode).toBe(200);
        expect(proxied.json().ip).toBe("198.51.100.25");

        const unsigned = await prodApp.inject({
          method: "GET",
          url: "/__probe",
          remoteAddress: "10.0.0.9",
          headers: {
            "x-advancepay-proxy-token": "attacker-token",
            "x-advancepay-client-ip": "203.0.113.10",
          },
        });
        expect(unsigned.json().ip).toBe("10.0.0.9");

        const devForwarded = await devApp.inject({
          method: "GET",
          url: "/__probe",
          remoteAddress: "192.168.1.50",
          headers: { "x-forwarded-for": "198.51.100.25", "x-real-ip": "203.0.113.1" },
        });
        expect(devForwarded.json().ip).toBe("192.168.1.50");
      } finally {
        if (originalSecret === undefined) delete process.env.PROXY_SHARED_SECRET;
        else process.env.PROXY_SHARED_SECRET = originalSecret;
      }
    });

    it("Helmet: Emits baseline security headers and enforces HSTS in production mode", async () => {
      const helmetModule = await import("@fastify/helmet");
      const fastifyHelmet = helmetModule.default || helmetModule;

      async function buildTestHelmetApp(isProd: boolean) {
        const testApp = Fastify();
        await testApp.register(fastifyHelmet, {
          contentSecurityPolicy: false,
          crossOriginResourcePolicy: false,
          crossOriginOpenerPolicy: false,
          xFrameOptions: { action: "deny" },
          xContentTypeOptions: true,
          referrerPolicy: { policy: "strict-origin-when-cross-origin" },
          hsts: isProd
            ? {
                maxAge: 31536000,
                includeSubDomains: false,
              }
            : false,
        });

        testApp.get("/headers-test", async () => ({ status: "ok" }));
        await testApp.ready();
        return testApp;
      }

      // 1. In Production Mode: Baseline headers + Strict-Transport-Security (without preload / includeSubDomains)
      const prodApp = await buildTestHelmetApp(true);
      const prodRes = await prodApp.inject({ method: "GET", url: "/headers-test" });

      expect(prodRes.statusCode).toBe(200);
      expect(prodRes.headers["x-content-type-options"]).toBe("nosniff");
      expect(prodRes.headers["x-frame-options"]).toBe("DENY");
      expect(prodRes.headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
      expect(prodRes.headers["strict-transport-security"]).toBe("max-age=31536000");

      // 2. In Non-Production Mode: Baseline headers present, HSTS absent
      const devApp = await buildTestHelmetApp(false);
      const devRes = await devApp.inject({ method: "GET", url: "/headers-test" });

      expect(devRes.statusCode).toBe(200);
      expect(devRes.headers["x-content-type-options"]).toBe("nosniff");
      expect(devRes.headers["x-frame-options"]).toBe("DENY");
      expect(devRes.headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
      expect(devRes.headers["strict-transport-security"]).toBeUndefined();
    });

    it("PayloadProtection: Enforces 128KB bodyLimit returning HTTP 413 and validates string length bounds", async () => {
      const testLimitApp = Fastify({
        bodyLimit: 128 * 1024,
      });

      testLimitApp.setErrorHandler((error: any, request, reply) => {
        if (typeof error.statusCode === "number" && error.statusCode >= 400 && error.statusCode < 500) {
          return reply.code(error.statusCode).send({
            success: false,
            message: error.message || "Bad Request",
          });
        }
        return reply.code(500).send({ success: false, message: "Internal server error" });
      });

      testLimitApp.post("/limit-test", async () => ({ success: true }));
      await testLimitApp.ready();

      // 1. Oversized body (>128 KB) returns HTTP 413
      const largePayload = { large: "A".repeat(130 * 1024) };
      const res413 = await testLimitApp.inject({
        method: "POST",
        url: "/limit-test",
        payload: largePayload,
      });
      expect(res413.statusCode).toBe(413);
      expect(res413.json()).toEqual({
        success: false,
        message: "Request body is too large",
      });

      // 2. Customer name > 100 characters is rejected by customerSchema
      const longCustomerResult = customerSchema.safeParse({
        name: "C".repeat(101),
        phone: "9876543210",
      });
      expect(longCustomerResult.success).toBe(false);
      if (!longCustomerResult.success) {
        expect(longCustomerResult.error.issues[0]?.message).toContain("Customer name cannot exceed 100 characters");
      }

      // Valid customer name (<= 100 chars) passes
      const validCustomerResult = customerSchema.safeParse({
        name: "C".repeat(100),
        phone: "9876543210",
      });
      expect(validCustomerResult.success).toBe(true);

      // 3. Item name > 100 characters is rejected by orderCreateSchema
      const longItemResult = orderCreateSchema.safeParse({
        itemName: "I".repeat(101),
        totalAmount: 1000,
        advance: 500,
        customerId: 1,
        promisedDate: "2026-12-01",
      });
      expect(longItemResult.success).toBe(false);
      if (!longItemResult.success) {
        expect(longItemResult.error.issues[0]?.message).toContain("Item name cannot exceed 100 characters");
      }

      // Valid item name (<= 100 chars) passes
      const validItemResult = orderCreateSchema.safeParse({
        itemName: "I".repeat(100),
        totalAmount: 1000,
        advance: 500,
        customerId: 1,
        promisedDate: "2026-12-01",
      });
      expect(validItemResult.success).toBe(true);

      // 4. Stage name > 50 characters is rejected by orderStageCreateSchema
      const longStageResult = orderStageCreateSchema.safeParse({
        name: "S".repeat(51),
      });
      expect(longStageResult.success).toBe(false);
      if (!longStageResult.success) {
        expect(longStageResult.error.issues[0]?.message).toContain("Stage name cannot exceed 50 characters");
      }

      // 5. Password > 72 UTF-8 bytes is rejected (protecting bcrypt 72-byte limit from silent truncation)
      const longPasswordReg = ownerRegisterSchema.safeParse({
        name: "Owner",
        email: "owner@example.com",
        password: "P".repeat(73),
        confirmPassword: "P".repeat(73),
      });
      expect(longPasswordReg.success).toBe(false);
      if (!longPasswordReg.success) {
        expect(longPasswordReg.error.issues[0]?.message).toContain("Password cannot exceed 72 UTF-8 bytes");
      }

      const longPasswordLogin = loginSchema.safeParse({
        email: "owner@example.com",
        password: "P".repeat(73),
      });
      expect(longPasswordLogin.success).toBe(false);
      if (!longPasswordLogin.success) {
        expect(longPasswordLogin.error.issues[0]?.message).toContain("Password cannot exceed 72 UTF-8 bytes");
      }

      // Valid 72-character password succeeds in both schemas
      const valid72Reg = ownerRegisterSchema.safeParse({
        name: "Owner",
        email: "owner@example.com",
        password: "P".repeat(72),
        confirmPassword: "P".repeat(72),
      });
      expect(valid72Reg.success).toBe(true);

      const valid72Login = loginSchema.safeParse({
        email: "owner@example.com",
        password: "P".repeat(72),
      });
      expect(valid72Login.success).toBe(true);
    });

    it("WebhookRawBody: Verifies 128KB limit, byte-for-byte HMAC integrity, and oversized 413 handling", async () => {
      const rawBodyModule = await import("fastify-raw-body");
      const rawBody = rawBodyModule.default || rawBodyModule;
      const { createHmac, timingSafeEqual } = await import("node:crypto");

      const webhookSecret = "test_webhook_secret_key_12345";
      const webhookApp = Fastify({
        bodyLimit: 128 * 1024,
      });

      await webhookApp.register(rawBody, {
        field: "rawBody",
        global: false,
        encoding: "utf8",
        runFirst: true,
      });

      webhookApp.setErrorHandler((error: any, request, reply) => {
        if (typeof error.statusCode === "number" && error.statusCode >= 400 && error.statusCode < 500) {
          return reply.code(error.statusCode).send({
            success: false,
            message: error.message || "Bad Request",
          });
        }
        return reply.code(500).send({ success: false, message: "Internal server error" });
      });

      webhookApp.post(
        "/webhooks/razorpay-test",
        { config: { rawBody: true } },
        async (request, reply) => {
          const signature = request.headers["x-razorpay-signature"] as string;
          const raw = (request as any).rawBody;

          if (!signature || !raw) {
            return reply.code(400).send({ success: false, message: "Missing signature or body" });
          }

          const expectedSig = createHmac("sha256", webhookSecret).update(raw).digest("hex");
          const expectedBuf = Buffer.from(expectedSig, "hex");
          const receivedBuf = Buffer.from(signature, "hex");

          if (expectedBuf.length !== receivedBuf.length || !timingSafeEqual(expectedBuf, receivedBuf)) {
            return reply.code(400).send({ success: false, message: "Invalid signature" });
          }

          return reply.code(200).send({ success: true, message: "Webhook accepted" });
        }
      );

      await webhookApp.ready();

      // 1. Normal valid webhook payload succeeds with exact HMAC signature
      const validPayload = JSON.stringify({
        event: "payment.captured",
        payload: { payment: { entity: { id: "pay_12345", amount: 50000 } } },
      });
      const validSig = createHmac("sha256", webhookSecret).update(validPayload).digest("hex");

      const successRes = await webhookApp.inject({
        method: "POST",
        url: "/webhooks/razorpay-test",
        headers: {
          "x-razorpay-signature": validSig,
          "content-type": "application/json",
        },
        payload: validPayload,
      });

      expect(successRes.statusCode).toBe(200);
      expect(successRes.json()).toEqual({ success: true, message: "Webhook accepted" });

      // 2. Tampered signature is rejected with HTTP 400
      const invalidSigRes = await webhookApp.inject({
        method: "POST",
        url: "/webhooks/razorpay-test",
        headers: {
          "x-razorpay-signature": "a".repeat(64),
          "content-type": "application/json",
        },
        payload: validPayload,
      });
      expect(invalidSigRes.statusCode).toBe(400);
      expect(invalidSigRes.json().message).toBe("Invalid signature");

      // 3. Oversized webhook payload (>128 KB) receives HTTP 413
      const oversizedPayload = JSON.stringify({
        event: "payment.captured",
        largeData: "W".repeat(130 * 1024),
      });
      const oversizedSig = createHmac("sha256", webhookSecret).update(oversizedPayload).digest("hex");

      const oversizedRes = await webhookApp.inject({
        method: "POST",
        url: "/webhooks/razorpay-test",
        headers: {
          "x-razorpay-signature": oversizedSig,
          "content-type": "application/json",
        },
        payload: oversizedPayload,
      });

      expect(oversizedRes.statusCode).toBe(413);
      expect(oversizedRes.json()).toEqual({
        success: false,
        message: "Request body is too large",
      });
    });
  });
});

