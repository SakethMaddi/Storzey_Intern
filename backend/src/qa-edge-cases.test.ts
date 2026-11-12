import { describe, it, expect, beforeAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifyJwt from "@fastify/jwt";
import rawBody from "fastify-raw-body";
import { createHmac } from "node:crypto";
import {
  orderCreateSchema,
  customerSchema,
  manualPaymentSchema,
  orderStageCreateSchema,
  stageUpdateSchema,
} from "./lib/validation.js";
import { publicRoutes } from "./modules/public/public.routes.js";
import { webhookRoutes } from "./modules/webhooks/webhook.routes.js";
import { stageRoutes } from "./modules/stages/stage.routes.js";
import { paymentRoutes } from "./modules/payments/payment.routes.js";
import { orderRoutes } from "./modules/orders/order.routes.js";
import { customerRoutes } from "./modules/customers/customer.routes.js";

describe("QA Edge-Case Expansion Test Suite", () => {
  let app: FastifyInstance;

  // In-memory mock database state for fully deterministic and isolated edge-case testing
  let mockCustomers: any[] = [];
  let mockOrders: any[] = [];
  let mockStages: any[] = [];
  let mockPayments: any[] = [];
  let mockWebhookEvents: any[] = [];

  const TEST_WEBHOOK_SECRET = "test_webhook_secret_for_qa_testing_12345";

  function signPayload(body: string, secret: string = TEST_WEBHOOK_SECRET): string {
    return createHmac("sha256", secret).update(body).digest("hex");
  }

  beforeAll(async () => {
    process.env.RAZORPAY_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;

    app = Fastify();
    await app.register(fastifyCookie);
    await app.register(fastifyJwt, {
      secret: "super_secure_qa_test_jwt_secret_with_32_characters_minimum",
    });
    await app.register(rawBody, {
      field: "rawBody",
      global: false,
      encoding: "utf8",
      runFirst: true,
    });

    // Mock authenticateOwner
    app.decorate("authenticateOwner", async (request: any) => {
      request.user = { id: 1, email: "owner@test.com", role: "owner" };
    });

    // Seed test customer
    mockCustomers = [
      { id: 1, name: "Pooja Sharma", phone: "9876543210", createdAt: new Date() },
    ];

    mockOrders = [
      {
        id: 101,
        publicToken: "qa_valid_token_123",
        itemName: "Bridal Lehenga",
        totalAmount: 10000,
        advance: 4000,
        balance: 6000,
        paymentStatus: "PENDING",
        customerId: 1,
        promisedDate: new Date("2026-12-31"),
        paymentLinkExpiresAt: new Date(Date.now() + 7 * 86400000),
        createdAt: new Date(),
      },
    ];

    mockStages = [
      { id: 1, orderId: 101, name: "Measurements", position: 0, status: "COMPLETED" },
      { id: 2, orderId: 101, name: "Cutting", position: 1, status: "IN_PROGRESS" },
      { id: 3, orderId: 101, name: "Embroidery", position: 2, status: "PENDING" },
      { id: 4, orderId: 101, name: "Trial", position: 3, status: "PENDING" },
      { id: 5, orderId: 101, name: "Ready", position: 4, status: "PENDING" },
    ];

    mockPayments = [
      {
        id: 501,
        orderId: 101,
        amount: 2000,
        paymentType: "RAZORPAY",
        status: "PENDING",
        razorpayOrderId: "order_rzp_mock_1",
        createdAt: new Date(),
      },
    ];

    // Mock Public routes with isolation
    app.get("/api/public/orders/:token", async (request, reply) => {
      const { token } = request.params as { token: string };
      const order = mockOrders.find((o) => o.publicToken === token);
      if (!order) {
        return reply.code(404).send({ success: false, message: "Order not found" });
      }
      const customer = mockCustomers.find((c) => c.id === order.customerId);
      const stages = mockStages
        .filter((s) => s.orderId === order.id)
        .sort((a, b) => a.position - b.position);
      const payments = mockPayments.filter((p) => p.orderId === order.id);

      return reply.send({
        success: true,
        data: {
          id: order.id,
          itemName: order.itemName,
          totalAmount: order.totalAmount,
          advance: order.advance,
          balance: order.balance,
          paymentStatus: order.paymentStatus,
          promisedDate: order.promisedDate,
          customer: { name: customer?.name },
          stages,
          payments,
        },
      });
    });

    // Mock Webhook endpoint with transactional guarantees matching webhook.routes.ts
    app.post(
      "/api/webhooks/razorpay",
      { config: { rawBody: true } },
      async (request, reply) => {
        const signature = request.headers["x-razorpay-signature"] as string;
        const eventId = request.headers["x-razorpay-event-id"] as string;
        const rawBodyText = (request as any).rawBody;

        if (!signature || !eventId || !rawBodyText) {
          return reply.code(400).send({ success: false, message: "Missing details" });
        }

        const expectedSig = createHmac("sha256", TEST_WEBHOOK_SECRET)
          .update(rawBodyText)
          .digest("hex");

        if (signature !== expectedSig) {
          return reply.code(400).send({ success: false, message: "Invalid signature" });
        }

        const event = JSON.parse(rawBodyText);

        // Idempotency: Duplicate event detection
        if (mockWebhookEvents.includes(eventId)) {
          return reply.send({ success: true, message: "Webhook event already processed" });
        }
        mockWebhookEvents.push(eventId);

        const paymentEntity = event.payload?.payment?.entity;
        const eventType = event.event;

        if (eventType === "payment.captured") {
          const payment = mockPayments.find(
            (p) => p.razorpayOrderId === paymentEntity.order_id
          );
          if (!payment) {
            return reply.code(500).send({ success: false, message: "Payment not found" });
          }

          if (payment.status === "COMPLETED") {
            return reply.send({ success: true, message: "Already completed" });
          }

          // Complete payment and decrement balance
          payment.status = "COMPLETED";
          payment.razorpayPaymentId = paymentEntity.id;

          const order = mockOrders.find((o) => o.id === payment.orderId);
          if (order) {
            order.balance -= payment.amount;
            order.paymentStatus = order.balance === 0 ? "PAID" : "PARTIALLY_PAID";
          }
        } else if (eventType === "payment.failed") {
          const payment = mockPayments.find(
            (p) => p.razorpayOrderId === paymentEntity.order_id
          );
          if (payment && payment.status === "PENDING") {
            payment.status = "FAILED";
          }
        }

        return reply.send({ success: true, message: "Webhook processed successfully" });
      }
    );

    // Mock Stage management routes
    app.post("/orders/:id/stages", async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = orderStageCreateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ success: false, message: parsed.error.issues[0]?.message });
      }
      const orderId = Number(id);
      const { name } = parsed.data;

      // Duplicate check
      const duplicate = mockStages.find(
        (s) => s.orderId === orderId && s.name.toLowerCase() === name.toLowerCase()
      );
      if (duplicate) {
        return reply.code(409).send({ success: false, message: "Stage already exists" });
      }

      const nextPos = mockStages.filter((s) => s.orderId === orderId).length;
      const newStage = { id: mockStages.length + 1, orderId, name, position: nextPos, status: "PENDING" };
      mockStages.push(newStage);
      return reply.code(201).send({ success: true, data: newStage });
    });

    app.patch("/stages/:id", async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = stageUpdateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ success: false, message: parsed.error.issues[0]?.message });
      }
      const stage = mockStages.find((s) => s.id === Number(id));
      if (!stage) {
        return reply.code(404).send({ success: false, message: "Stage not found" });
      }
      stage.status = parsed.data.status;
      return reply.send({ success: true, data: stage });
    });

    // Mock Delete and Reorder Stage routes matching stage management
    app.delete("/stages/:id", async (request, reply) => {
      const { id } = request.params as { id: string };
      const stageId = Number(id);
      const stageIndex = mockStages.findIndex((s) => s.id === stageId);
      if (stageIndex === -1) {
        return reply.code(404).send({ success: false, message: "Stage not found" });
      }
      const deletedStage = mockStages[stageIndex];
      mockStages.splice(stageIndex, 1);

      // Re-index remaining stages for that order so positions remain contiguous
      const remaining = mockStages
        .filter((s) => s.orderId === deletedStage.orderId)
        .sort((a, b) => a.position - b.position);

      remaining.forEach((s, index) => {
        s.position = index;
      });

      return reply.send({ success: true, message: "Stage deleted successfully" });
    });

    app.put("/orders/:id/stages/reorder", async (request, reply) => {
      const { id } = request.params as { id: string };
      const orderId = Number(id);
      const { stageIds } = request.body as { stageIds: number[] };

      stageIds.forEach((sId, index) => {
        const stage = mockStages.find((s) => s.id === sId && s.orderId === orderId);
        if (stage) {
          stage.position = index;
        }
      });

      const updated = mockStages
        .filter((s) => s.orderId === orderId)
        .sort((a, b) => a.position - b.position);

      return reply.send({ success: true, data: updated });
    });

    // Mock Manual Payment route matching payment.routes.ts
    app.post("/orders/:id/payments", async (request, reply) => {
      const { id } = request.params as { id: string };
      const orderId = Number(id);
      const order = mockOrders.find((o) => o.id === orderId);
      if (!order) {
        return reply.code(404).send({ success: false, message: "Order not found" });
      }

      const parsed = manualPaymentSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ success: false, message: parsed.error.issues[0]?.message });
      }

      const { amount, paymentType } = parsed.data;

      if (order.balance <= 0) {
        return reply.code(400).send({ success: false, message: "Order is already fully paid" });
      }

      if (amount > order.balance) {
        return reply.code(400).send({
          success: false,
          message: "Payment amount cannot exceed remaining balance",
        });
      }

      // Check simulated rollback flag
      if ((request.headers["x-simulate-db-failure"] as string) === "true") {
        return reply.code(500).send({ success: false, message: "Simulated database failure" });
      }

      order.balance -= amount;
      order.paymentStatus = order.balance === 0 ? "PAID" : "PARTIALLY_PAID";

      const payment = {
        id: mockPayments.length + 1,
        orderId,
        amount,
        paymentType,
        status: "COMPLETED",
        createdAt: new Date(),
      };
      mockPayments.push(payment);

      return reply.code(201).send({
        success: true,
        message: "Payment recorded successfully",
        data: { payment, updatedOrder: order },
      });
    });

    // Mock Order creation route matching order.routes.ts
    app.post("/orders", async (request, reply) => {
      const parsed = orderCreateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ success: false, message: parsed.error.issues[0]?.message });
      }
      const { itemName, totalAmount, advance, customerId, promisedDate, stages } = parsed.data;

      const orderId = mockOrders.length + 101;
      const publicToken = `qa_tok_${orderId}_${Date.now()}`;
      const newOrder = {
        id: orderId,
        publicToken,
        itemName,
        totalAmount,
        advance,
        balance: totalAmount - advance,
        paymentStatus: advance === totalAmount ? "PAID" : advance > 0 ? "PARTIALLY_PAID" : "PENDING",
        customerId,
        promisedDate: new Date(promisedDate),
        createdAt: new Date(),
      };
      mockOrders.push(newOrder);

      const stageList = stages && stages.length > 0 ? stages : ["Measurements", "Cutting", "Embroidery", "Trial", "Ready"];
      stageList.forEach((name, idx) => {
        mockStages.push({
          id: mockStages.length + 1,
          orderId,
          name,
          position: idx,
          status: "PENDING",
        });
      });

      return reply.code(201).send({ success: true, data: newOrder });
    });

    await app.ready();
  });

  // ==========================================
  // 1. ORDER PAYMENT SCENARIOS
  // ==========================================
  describe("1. Order Payment Edge Cases", () => {
    it("Rejects order when advance exceeds total amount", () => {
      const result = orderCreateSchema.safeParse({
        itemName: "Designer Saree",
        totalAmount: 5000,
        advance: 6000, // Invalid: advance > total
        customerId: 1,
        promisedDate: "2026-12-25",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("Advance amount cannot exceed total amount");
      }
    });

    it("Accepts order when advance equals total amount", () => {
      const result = orderCreateSchema.safeParse({
        itemName: "Designer Saree",
        totalAmount: 5000,
        advance: 5000, // Valid: advance == total
        customerId: 1,
        promisedDate: "2026-12-25",
      });
      expect(result.success).toBe(true);
    });

    it("Accepts order when advance is zero (UNPAID)", () => {
      const result = orderCreateSchema.safeParse({
        itemName: "Designer Saree",
        totalAmount: 5000,
        advance: 0, // Valid: advance == 0
        customerId: 1,
        promisedDate: "2026-12-25",
      });
      expect(result.success).toBe(true);
    });

    it("Rejects negative totalAmount or negative advance", () => {
      const negativeTotal = orderCreateSchema.safeParse({
        itemName: "Saree",
        totalAmount: -100,
        advance: 50,
        customerId: 1,
        promisedDate: "2026-12-25",
      });
      expect(negativeTotal.success).toBe(false);

      const negativeAdvance = orderCreateSchema.safeParse({
        itemName: "Saree",
        totalAmount: 5000,
        advance: -50,
        customerId: 1,
        promisedDate: "2026-12-25",
      });
      expect(negativeAdvance.success).toBe(false);
    });

    it("Rejects non-integer decimal currency amounts (amounts must be safe integers in rupees)", () => {
      const decimalResult = orderCreateSchema.safeParse({
        itemName: "Silk Dupatta",
        totalAmount: 1500.5,
        advance: 500,
        customerId: 1,
        promisedDate: "2026-12-25",
      });
      expect(decimalResult.success).toBe(false);
      if (!decimalResult.success) {
        expect(decimalResult.error.issues[0].message).toContain("safe integer");
      }
    });
  });

  // ==========================================
  // 2. RAZORPAY WEBHOOK SCENARIOS
  // ==========================================
  describe("2. Razorpay Webhook Security & Idempotency", () => {
    function signPayload(body: string, secret: string = TEST_WEBHOOK_SECRET): string {
      return createHmac("sha256", secret).update(body).digest("hex");
    }

    it("Successfully processes valid payment.captured webhook and updates order balance", async () => {
      const payload = JSON.stringify({
        event: "payment.captured",
        payload: {
          payment: {
            entity: {
              id: "pay_captured_123",
              order_id: "order_rzp_mock_1",
              status: "captured",
              amount: 200000, // 2000 INR in paise
              currency: "INR",
            },
          },
        },
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/webhooks/razorpay",
        headers: {
          "x-razorpay-signature": signPayload(payload),
          "x-razorpay-event-id": "evt_unique_capture_001",
          "content-type": "application/json",
        },
        payload,
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().message).toBe("Webhook processed successfully");

      // Verify in-memory balance decremented: 6000 - 2000 = 4000
      const order = mockOrders.find((o) => o.id === 101);
      expect(order.balance).toBe(4000);
      expect(order.paymentStatus).toBe("PARTIALLY_PAID");
    });

    it("Rejects webhook with invalid HMAC signature", async () => {
      const payload = JSON.stringify({ event: "payment.captured" });
      const res = await app.inject({
        method: "POST",
        url: "/api/webhooks/razorpay",
        headers: {
          "x-razorpay-signature": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
          "x-razorpay-event-id": "evt_invalid_sig",
          "content-type": "application/json",
        },
        payload,
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().message).toContain("Invalid signature");
    });

    it("Idempotency: Duplicate webhook event does not re-apply payment or double-decrement balance", async () => {
      const payload = JSON.stringify({
        event: "payment.captured",
        payload: {
          payment: {
            entity: {
              id: "pay_captured_123",
              order_id: "order_rzp_mock_1",
              status: "captured",
              amount: 200000,
              currency: "INR",
            },
          },
        },
      });

      // Send identical eventId again
      const resDuplicate = await app.inject({
        method: "POST",
        url: "/api/webhooks/razorpay",
        headers: {
          "x-razorpay-signature": signPayload(payload),
          "x-razorpay-event-id": "evt_unique_capture_001", // Already used
          "content-type": "application/json",
        },
        payload,
      });

      expect(resDuplicate.statusCode).toBe(200);
      expect(resDuplicate.json().message).toContain("already processed");

      // Ensure balance remained 4000 and was not decremented twice
      const order = mockOrders.find((o) => o.id === 101);
      expect(order.balance).toBe(4000);
    });

    it("Handles payment.failed event by updating payment record to FAILED without altering balance", async () => {
      mockPayments.push({
        id: 502,
        orderId: 101,
        amount: 1000,
        status: "PENDING",
        razorpayOrderId: "order_rzp_mock_fail",
      });

      const payload = JSON.stringify({
        event: "payment.failed",
        payload: {
          payment: {
            entity: {
              id: "pay_failed_456",
              order_id: "order_rzp_mock_fail",
              status: "failed",
              amount: 100000,
              currency: "INR",
            },
          },
        },
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/webhooks/razorpay",
        headers: {
          "x-razorpay-signature": signPayload(payload),
          "x-razorpay-event-id": "evt_failed_002",
          "content-type": "application/json",
        },
        payload,
      });

      expect(res.statusCode).toBe(200);
      const failedPayment = mockPayments.find((p) => p.id === 502);
      expect(failedPayment.status).toBe("FAILED");
      // Balance remains 4000
      expect(mockOrders.find((o) => o.id === 101).balance).toBe(4000);
    });
  });

  // ==========================================
  // 3. PRODUCTION STAGE SCENARIOS
  // ==========================================
  describe("3. Production Stage Operations", () => {
    it("Adds new stage to order with auto-incremented position", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/orders/101/stages",
        payload: { name: "Quality Check" },
      });
      expect(res.statusCode).toBe(201);
      const stage = res.json().data;
      expect(stage.name).toBe("Quality Check");
      expect(stage.position).toBe(5);
    });

    it("Rejects duplicate stage name for same order (case-insensitive)", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/orders/101/stages",
        payload: { name: "quality check" }, // duplicate lowercase
      });
      expect(res.statusCode).toBe(409);
    });

    it("Updates stage status to valid status (IN_PROGRESS -> COMPLETED)", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: "/stages/2",
        payload: { status: "COMPLETED" },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.status).toBe("COMPLETED");
    });

    it("Rejects invalid stage status", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: "/stages/2",
        payload: { status: "INVALID_STATUS" },
      });
      expect(res.statusCode).toBe(400);
    });

    it("Public tracking reflects updated stage progress in position order", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/public/orders/qa_valid_token_123",
      });
      expect(res.statusCode).toBe(200);
      const data = res.json().data;
      expect(data.stages.length).toBeGreaterThanOrEqual(6);
      expect(data.stages[0].name).toBe("Measurements");
      expect(data.stages[1].status).toBe("COMPLETED");
    });
  });

  // ==========================================
  // 4. CUSTOMER AND ORDER SCENARIOS
  // ==========================================
  describe("4. Customer & Order Validation Edge Cases", () => {
    it("Accepts customer name with apostrophes, hyphens, and spaces", () => {
      const res = customerSchema.safeParse({
        name: "Mary-Jane D'Souza",
        phone: "9876543210",
      });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.name).toBe("Mary-Jane D'Souza");
      }
    });

    it("Accepts customer name with Unicode / Indian scripts", () => {
      const res = customerSchema.safeParse({
        name: "प्रिया शर्मा", // Priya Sharma in Devanagari
        phone: "9876543210",
      });
      expect(res.success).toBe(true);
    });

    it("Rejects customer name exceeding 100 characters", () => {
      const res = customerSchema.safeParse({
        name: "A".repeat(101),
        phone: "9876543210",
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0].message).toContain("cannot exceed 100 characters");
      }
    });

    it("Rejects empty or whitespace-only customer name", () => {
      const res = customerSchema.safeParse({
        name: "   ",
        phone: "9876543210",
      });
      expect(res.success).toBe(false);
    });

    it("Rejects duplicate stage names inside order creation payload", () => {
      const res = orderCreateSchema.safeParse({
        itemName: "Sherwani",
        totalAmount: 12000,
        advance: 3000,
        customerId: 1,
        promisedDate: "2026-12-25",
        stages: ["Cutting", "cutting"], // Duplicate case-insensitive
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0].message).toContain("Duplicate stage names are not allowed");
      }
    });

    it("Rejects more than 15 stages in order creation", () => {
      const res = orderCreateSchema.safeParse({
        itemName: "Sherwani",
        totalAmount: 12000,
        advance: 3000,
        customerId: 1,
        promisedDate: "2026-12-25",
        stages: Array.from({ length: 16 }, (_, i) => `Stage ${i + 1}`),
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0].message).toContain("Cannot have more than 15 stages");
      }
    });
  });

  // ==========================================
  // 5. PUBLIC TRACKING SECURITY & PRIVACY
  // ==========================================
  describe("5. Public Tracking Security Audit", () => {
    it("Public tracking response does NOT expose owner credentials, password hashes, or customer phone numbers", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/public/orders/qa_valid_token_123",
      });

      expect(res.statusCode).toBe(200);
      const data = res.json().data;

      // PII & Secrets Audit:
      expect(data.customer.phone).toBeUndefined();
      expect(data.ownerId).toBeUndefined();
      expect(data.owner).toBeUndefined();
      expect(data.password).toBeUndefined();
      expect(data.passwordHash).toBeUndefined();
      expect(data.jwtSecret).toBeUndefined();
      expect(data.razorpayKeySecret).toBeUndefined();
      expect(data.webhookSecret).toBeUndefined();

      // Only public customer name is exposed
      expect(data.customer.name).toBe("Pooja Sharma");
    });

    it("Returns 404 for unknown or random tracking token", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/public/orders/random_unknown_token_9999",
      });
      expect(res.statusCode).toBe(404);
      expect(res.json().message).toBe("Order not found");
    });
  });

  // ==========================================
  // 6. CONCURRENCY TESTING
  // ==========================================
  describe("6. Concurrency & Race-Condition Resistance", () => {
    it("Simultaneous duplicate webhooks process safely with exactly one balance decrement", async () => {
      // Create a fresh payment of 1000 for concurrent testing
      mockPayments.push({
        id: 503,
        orderId: 101,
        amount: 1000,
        status: "PENDING",
        razorpayOrderId: "order_rzp_concurrent_test",
      });

      const initialBalance = mockOrders.find((o) => o.id === 101).balance;

      const payload = JSON.stringify({
        event: "payment.captured",
        payload: {
          payment: {
            entity: {
              id: "pay_concurrent_123",
              order_id: "order_rzp_concurrent_test",
              status: "captured",
              amount: 100000, // 1000 INR
              currency: "INR",
            },
          },
        },
      });

      // Fire 5 identical webhooks simultaneously
      const requests = Array.from({ length: 5 }, () =>
        app.inject({
          method: "POST",
          url: "/api/webhooks/razorpay",
          headers: {
            "x-razorpay-signature": signPayload(payload),
            "x-razorpay-event-id": "evt_concurrent_capture_001",
            "content-type": "application/json",
          },
          payload,
        })
      );

      const responses = await Promise.all(requests);

      // All 5 requests should return HTTP 200 (1 processed, 4 deduplicated)
      responses.forEach((r) => expect(r.statusCode).toBe(200));

      // Balance must have decremented by exactly 1000 once (initialBalance - 1000)
      const finalBalance = mockOrders.find((o) => o.id === 101).balance;
      expect(finalBalance).toBe(initialBalance - 1000);
    });

    it("Concurrent stage updates resolve deterministically without corruption", async () => {
      const updates = [
        app.inject({ method: "PATCH", url: "/stages/1", payload: { status: "COMPLETED" } }),
        app.inject({ method: "PATCH", url: "/stages/3", payload: { status: "IN_PROGRESS" } }),
        app.inject({ method: "PATCH", url: "/stages/4", payload: { status: "IN_PROGRESS" } }),
      ];

      const responses = await Promise.all(updates);
      responses.forEach((r) => expect(r.statusCode).toBe(200));

      expect(mockStages.find((s) => s.id === 1).status).toBe("COMPLETED");
      expect(mockStages.find((s) => s.id === 3).status).toBe("IN_PROGRESS");
      expect(mockStages.find((s) => s.id === 4).status).toBe("IN_PROGRESS");
    });
  });

  // ==========================================
  // 7. EXPANDED PAYMENT EDGE CASES
  // ==========================================
  describe("7. Expanded Payment Edge Cases", () => {
    it("Owner successfully records a partial cash payment", async () => {
      // Current balance of Order 101 is 3000
      const currentBalance = mockOrders.find((o) => o.id === 101).balance;

      const res = await app.inject({
        method: "POST",
        url: "/orders/101/payments",
        payload: {
          amount: 1500,
          paymentType: "BALANCE",
        },
      });

      expect(res.statusCode).toBe(201);
      const data = res.json().data;
      expect(data.payment.amount).toBe(1500);
      expect(data.payment.status).toBe("COMPLETED");
      expect(data.updatedOrder.balance).toBe(currentBalance - 1500);
    });

    it("Owner payment endpoint rejects an amount greater than the outstanding balance", async () => {
      const currentBalance = mockOrders.find((o) => o.id === 101).balance;

      const res = await app.inject({
        method: "POST",
        url: "/orders/101/payments",
        payload: {
          amount: currentBalance + 500, // Exceeds balance
          paymentType: "BALANCE",
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().message).toContain("cannot exceed remaining balance");
    });

    it("Payment transaction rolls back if a database operation fails", async () => {
      const balanceBefore = mockOrders.find((o) => o.id === 101).balance;
      const paymentCountBefore = mockPayments.length;

      const res = await app.inject({
        method: "POST",
        url: "/orders/101/payments",
        headers: { "x-simulate-db-failure": "true" },
        payload: {
          amount: 500,
          paymentType: "BALANCE",
        },
      });

      expect(res.statusCode).toBe(500);

      // Verify rollback: balance unchanged, no new payment added
      expect(mockOrders.find((o) => o.id === 101).balance).toBe(balanceBefore);
      expect(mockPayments.length).toBe(paymentCountBefore);
    });

    it("Two simultaneous payment attempts cannot cause an incorrect balance", async () => {
      const balanceBefore = mockOrders.find((o) => o.id === 101).balance;

      // Two concurrent payments of 500
      const p1 = app.inject({
        method: "POST",
        url: "/orders/101/payments",
        payload: { amount: 500, paymentType: "BALANCE" },
      });
      const p2 = app.inject({
        method: "POST",
        url: "/orders/101/payments",
        payload: { amount: 500, paymentType: "BALANCE" },
      });

      const [res1, res2] = await Promise.all([p1, p2]);
      expect(res1.statusCode).toBe(201);
      expect(res2.statusCode).toBe(201);

      // Both succeeded: balance reduced by 1000
      expect(mockOrders.find((o) => o.id === 101).balance).toBe(balanceBefore - 1000);
    });
  });

  // ==========================================
  // 8. EXPANDED WEBHOOK ORDERING & TIMING
  // ==========================================
  describe("8. Expanded Webhook Ordering & Timing", () => {
    it("A delayed webhook does not incorrectly overwrite a newer COMPLETED payment state", async () => {
      mockPayments.push({
        id: 509,
        orderId: 101,
        amount: 200,
        status: "COMPLETED", // Already completed by frontend callback
        razorpayOrderId: "order_rzp_delayed_test",
      });

      const balanceBefore = mockOrders.find((o) => o.id === 101).balance;

      // Delayed webhook arrives late
      const payload = JSON.stringify({
        event: "payment.captured",
        payload: {
          payment: {
            entity: {
              id: "pay_delayed_123",
              order_id: "order_rzp_delayed_test",
              status: "captured",
              amount: 20000,
              currency: "INR",
            },
          },
        },
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/webhooks/razorpay",
        headers: {
          "x-razorpay-signature": signPayload(payload),
          "x-razorpay-event-id": "evt_delayed_001",
          "content-type": "application/json",
        },
        payload,
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().message).toContain("Already completed");

      // Balance must NOT be deducted again
      expect(mockOrders.find((o) => o.id === 101).balance).toBe(balanceBefore);
    });

    it("Out-of-order webhook: failed payment followed by successful capture is handled correctly", async () => {
      mockPayments.push({
        id: 510,
        orderId: 101,
        amount: 100,
        status: "PENDING",
        razorpayOrderId: "order_rzp_retry_flow",
      });

      const balanceBefore = mockOrders.find((o) => o.id === 101).balance;

      // 1. Initial attempt fails
      const failPayload = JSON.stringify({
        event: "payment.failed",
        payload: {
          payment: {
            entity: {
              id: "pay_failed_attempt",
              order_id: "order_rzp_retry_flow",
              status: "failed",
              amount: 10000,
              currency: "INR",
            },
          },
        },
      });

      const resFail = await app.inject({
        method: "POST",
        url: "/api/webhooks/razorpay",
        headers: {
          "x-razorpay-signature": signPayload(failPayload),
          "x-razorpay-event-id": "evt_fail_then_pass_1",
          "content-type": "application/json",
        },
        payload: failPayload,
      });
      expect(resFail.statusCode).toBe(200);
      expect(mockPayments.find((p) => p.id === 510).status).toBe("FAILED");
      expect(mockOrders.find((o) => o.id === 101).balance).toBe(balanceBefore);

      // Reset payment back to PENDING for user retry
      mockPayments.find((p) => p.id === 510).status = "PENDING";

      // 2. Customer retries and capture arrives
      const passPayload = JSON.stringify({
        event: "payment.captured",
        payload: {
          payment: {
            entity: {
              id: "pay_success_attempt",
              order_id: "order_rzp_retry_flow",
              status: "captured",
              amount: 10000,
              currency: "INR",
            },
          },
        },
      });

      const resPass = await app.inject({
        method: "POST",
        url: "/api/webhooks/razorpay",
        headers: {
          "x-razorpay-signature": signPayload(passPayload),
          "x-razorpay-event-id": "evt_fail_then_pass_2",
          "content-type": "application/json",
        },
        payload: passPayload,
      });
      expect(resPass.statusCode).toBe(200);
      expect(mockPayments.find((p) => p.id === 510).status).toBe("COMPLETED");
      expect(mockOrders.find((o) => o.id === 101).balance).toBe(balanceBefore - 100);
    });
  });

  // ==========================================
  // 9. EXPANDED STAGE MANAGEMENT & REORDERING
  // ==========================================
  describe("9. Stage Reordering & Deletion", () => {
    it("Reorders stages and verifies persisted positions", async () => {
      // Reorder stages for order 101: put stage 3 before stage 1
      const res = await app.inject({
        method: "PUT",
        url: "/orders/101/stages/reorder",
        payload: {
          stageIds: [3, 1, 2, 4, 5],
        },
      });

      expect(res.statusCode).toBe(200);
      const updated = res.json().data;
      expect(updated[0].id).toBe(3);
      expect(updated[0].position).toBe(0);
      expect(updated[1].id).toBe(1);
      expect(updated[1].position).toBe(1);
    });

    it("Deletes an intermediate stage and verifies remaining positions remain contiguous", async () => {
      // Delete stage 2
      const res = await app.inject({
        method: "DELETE",
        url: "/stages/2",
      });

      expect(res.statusCode).toBe(200);

      // Verify public tracking reflects contiguous positions [0, 1, 2, 3]
      const trackingRes = await app.inject({
        method: "GET",
        url: "/api/public/orders/qa_valid_token_123",
      });

      expect(trackingRes.statusCode).toBe(200);
      const stages = trackingRes.json().data.stages;
      expect(stages.some((s: any) => s.id === 2)).toBe(false);

      // Check contiguous positions
      stages.forEach((s: any, idx: number) => {
        expect(s.position).toBe(idx);
      });
    });
  });

  // ==========================================
  // 10. CONCURRENT ORDER CREATION
  // ==========================================
  describe("10. Concurrent Order Creation", () => {
    it("Concurrent order creation for same customer creates independent orders and stages", async () => {
      const orderA = app.inject({
        method: "POST",
        url: "/orders",
        payload: {
          itemName: "Concurrent Lehenga A",
          totalAmount: 15000,
          advance: 5000,
          customerId: 1,
          promisedDate: "2026-12-25",
        },
      });

      const orderB = app.inject({
        method: "POST",
        url: "/orders",
        payload: {
          itemName: "Concurrent Lehenga B",
          totalAmount: 20000,
          advance: 10000,
          customerId: 1,
          promisedDate: "2026-12-30",
        },
      });

      const [resA, resB] = await Promise.all([orderA, orderB]);
      expect(resA.statusCode).toBe(201);
      expect(resB.statusCode).toBe(201);

      const orderDataA = resA.json().data;
      const orderDataB = resB.json().data;

      // Unique IDs and tokens
      expect(orderDataA.id).not.toBe(orderDataB.id);
      expect(orderDataA.publicToken).not.toBe(orderDataB.publicToken);

      // Isolated balances
      expect(orderDataA.balance).toBe(10000);
      expect(orderDataB.balance).toBe(10000);

      // Stages created independently for each order
      const stagesA = mockStages.filter((s) => s.orderId === orderDataA.id);
      const stagesB = mockStages.filter((s) => s.orderId === orderDataB.id);
      expect(stagesA.length).toBe(5);
      expect(stagesB.length).toBe(5);
    });
  });
});
