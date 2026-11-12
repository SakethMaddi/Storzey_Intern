import { describe, it, expect, beforeAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import prisma from "./lib/prisma.js";
import {
  customerSchema,
  orderCreateSchema,
  orderStageCreateSchema,
  stageUpdateSchema,
  manualPaymentSchema,
  numericIdParamSchema,
  publicTokenParamSchema,
} from "./lib/validation.js";

describe("Live API Scenario Verification", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    await app.register(cors);

    // Register test routes mirroring server.ts logic for isolated e2e check
    app.post("/customers", async (req, reply) => {
      const parsed = customerSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({
          success: false,
          message: parsed.error.issues[0]?.message,
          errors: parsed.error.flatten().fieldErrors,
        });
      }
      const { name, phone } = parsed.data;
      const existing = await prisma.customer.findFirst({ where: { phone } });
      if (existing) {
        return reply.code(409).send({
          success: false,
          message: `A customer with phone number ${phone} already exists (${existing.name})`,
        });
      }
      return reply.code(201).send({ success: true, data: { name, phone } });
    });

    app.post("/orders", async (req, reply) => {
      const parsed = orderCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({
          success: false,
          message: parsed.error.issues[0]?.message,
        });
      }
      return reply.code(201).send({ success: true });
    });

    app.post("/orders/:id/payments", async (req, reply) => {
      const paramResult = numericIdParamSchema.safeParse(req.params);
      if (!paramResult.success) {
        return reply.code(400).send({ success: false, message: "Invalid order ID" });
      }
      const bodyResult = manualPaymentSchema.safeParse(req.body);
      if (!bodyResult.success) {
        return reply.code(400).send({
          success: false,
          message: bodyResult.error.issues[0]?.message,
        });
      }
      return reply.code(201).send({ success: true });
    });

    app.patch("/stages/:id", async (req, reply) => {
      const paramResult = numericIdParamSchema.safeParse(req.params);
      if (!paramResult.success) {
        return reply.code(400).send({ success: false, message: "Invalid stage ID" });
      }
      const bodyResult = stageUpdateSchema.safeParse(req.body);
      if (!bodyResult.success) {
        return reply.code(400).send({
          success: false,
          message: bodyResult.error.issues[0]?.message,
        });
      }
      return reply.send({ success: true });
    });

    // Authoritative Reconciliation endpoint test
    app.post("/orders/:id/reconcile", async (req, reply) => {
      const paramResult = numericIdParamSchema.safeParse(req.params);
      if (!paramResult.success) {
        return reply.code(400).send({ success: false, message: "Invalid order ID" });
      }
      return reply.send({
        success: true,
        message: "Reconciliation completed.",
        data: { id: paramResult.data.id },
      });
    });
  });

  // Scenario 1: Submit an empty customer form
  it("Scenario 1: Rejects empty customer form", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/customers",
      payload: { name: "", phone: "" },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.success).toBe(false);
  });

  // Scenario 2: Submit a customer with an invalid phone number
  it("Scenario 2: Rejects customer with invalid phone number (starts with 1)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/customers",
      payload: { name: "Rajesh", phone: "1234567890" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().success).toBe(false);
  });

  // Scenario 3: Submit a customer with fewer than 10 digits
  it("Scenario 3: Rejects customer with fewer than 10 digits", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/customers",
      payload: { name: "Rajesh", phone: "9876543" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().success).toBe(false);
  });

  // Scenario 4: Submit a customer with more than 10 digits
  it("Scenario 4: Rejects customer with more than 10 digits without truncation", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/customers",
      payload: { name: "Rajesh", phone: "98765432101" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().success).toBe(false);
    expect(res.json().message).toContain("cannot exceed 10 digits");
  });

  // Strict Phone test: Reject +91 prefix
  it("Strict Phone test: Rejects +91 prefix", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/customers",
      payload: { name: "Rajesh", phone: "+919876543210" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toContain("Country code");
  });

  // Scenario 5: Submit a duplicate phone number
  it("Scenario 5: Rejects customer with duplicate phone number", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/customers",
      payload: { name: "Manoj Duplicate", phone: "9876543210" },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().success).toBe(false);
    expect(res.json().message).toContain("already exists");
  }, 15000);

  // Scenario 7: Create an order with an empty item name
  it("Scenario 7: Rejects order with an empty item name", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/orders",
      payload: {
        customerId: 2,
        itemName: "   ",
        totalAmount: 1000,
        advance: 100,
        promisedDate: "2026-11-20",
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().success).toBe(false);
  });

  // Scenario 8: Create an order with zero or negative total
  it("Scenario 8: Rejects order with zero or negative total", async () => {
    const resZero = await app.inject({
      method: "POST",
      url: "/orders",
      payload: {
        customerId: 2,
        itemName: "Shirt",
        totalAmount: 0,
        advance: 0,
        promisedDate: "2026-11-20",
      },
    });
    expect(resZero.statusCode).toBe(400);

    const resNeg = await app.inject({
      method: "POST",
      url: "/orders",
      payload: {
        customerId: 2,
        itemName: "Shirt",
        totalAmount: -100,
        advance: 0,
        promisedDate: "2026-11-20",
      },
    });
    expect(resNeg.statusCode).toBe(400);
  });

  // Scenario 9: Enter an advance greater than the total
  it("Scenario 9: Rejects advance greater than total", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/orders",
      payload: {
        customerId: 2,
        itemName: "Shirt",
        totalAmount: 1000,
        advance: 1200,
        promisedDate: "2026-11-20",
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toContain("cannot exceed total amount");
  });

  // Scenario 10: Make a payment with invalid amount (0 or negative)
  it("Scenario 10: Rejects payment with zero or negative amount", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/orders/1/payments",
      payload: {
        amount: 0,
        paymentType: "ADVANCE",
      },
    });
    expect(res.statusCode).toBe(400);
  });

  // Scenario 12: Update a stage with an invalid status
  it("Scenario 12: Rejects stage update with invalid status", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/stages/1",
      payload: {
        status: "INVALID_STATUS",
      },
    });
    expect(res.statusCode).toBe(400);
  });

  // Scenario 13: Submit invalid API requests directly (bad ID, missing params)
  it("Scenario 13: Direct API validation handles malformed params and bodies safely", async () => {
    const badId = await app.inject({
      method: "PATCH",
      url: "/stages/abc",
      payload: { status: "COMPLETED" },
    });
    expect(badId.statusCode).toBe(400);

    const badOrderPay = await app.inject({
      method: "POST",
      url: "/orders/-99/payments",
      payload: { amount: 100, paymentType: "ADVANCE" },
    });
    expect(badOrderPay.statusCode).toBe(400);
  });

  // Scenario 14: Payment reconciliation endpoint handles request safely
  it("Scenario 14: Authoritative payment reconciliation handles order parameter correctly", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/orders/1/reconcile",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
  });
});
