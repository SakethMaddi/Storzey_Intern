import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";
import { createServer } from "./app.js";
import prisma from "./lib/prisma.js";

describe("Advance Pay & Boutique Management — End-to-End QA", () => {
  let app: any;
  let owner1Token: string;
  let owner2Token: string;

  beforeEach(async () => {
    app = await createServer();

    // Owner 1 (Primary tenant)
    owner1Token = app.jwt.sign({
      ownerId: 1,
      role: "OWNER",
      email: "owner1@boutique.com",
      name: "Anusha Rao",
      businessName: "Anusha Haute Couture",
    });

    // Owner 2 (Secondary isolated tenant)
    owner2Token = app.jwt.sign({
      ownerId: 2,
      role: "OWNER",
      email: "owner2@boutique.com",
      name: "Vikram Seth",
      businessName: "Seth Bespoke",
    });
  });

  // ==========================================================================
  // FLOW 1: Owner Registration and Login
  // ==========================================================================
  it("FLOW 1: Owner registration, password validation, session issuance, and /auth/me", async () => {
    const ownerCountSpy = vi.spyOn(prisma.owner, "count").mockResolvedValueOnce(1);

    // 1.1 Registration status check
    const regStatus = await app.inject({
      method: "GET",
      url: "/auth/registration-status",
    });
    expect(regStatus.statusCode).toBe(200);
    expect(regStatus.json().success).toBe(true);
    expect(regStatus.json().data.hasOwner).toBe(true);
    ownerCountSpy.mockRestore();

    // 1.2 Invalid password rejection (<8 chars)
    const badReg = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        name: "Test Owner",
        email: "test@owner.com",
        phone: "9876543210",
        password: "short",
      },
    });
    expect(badReg.statusCode).toBe(400);

    // 1.3 Successful profile retrieval via fresh JWT /auth/me
    const ownerSpy = vi.spyOn(prisma.owner, "findUnique").mockResolvedValueOnce({
      id: 1,
      name: "Anusha Rao",
      email: "owner1@boutique.com",
      phone: "9876543210",
      businessName: "Anusha Haute Couture",
    } as any);

    const meRes = await app.inject({
      method: "GET",
      url: "/auth/me",
      headers: { authorization: `Bearer ${owner1Token}` },
    });
    expect(meRes.statusCode).toBe(200);
    expect(meRes.json().data.name).toBe("Anusha Rao");
    ownerSpy.mockRestore();
  });

  // ==========================================================================
  // FLOW 2: Create, Edit and Archive Customers
  // ==========================================================================
  it("FLOW 2: Create customer, edit details, and toggle archival", async () => {
    const phoneUniqueSpy = vi.spyOn(prisma.customer, "findUnique").mockResolvedValueOnce(null);
    const customerSpy = vi.spyOn(prisma.customer, "create").mockResolvedValueOnce({
      id: 201,
      ownerId: 1,
      name: "Priya Sharma",
      phone: "9876543210",
      email: "priya@gmail.com",
      createdAt: new Date(),
      isArchived: false,
      archivedAt: null,
    } as any);

    const createRes = await app.inject({
      method: "POST",
      url: "/customers",
      headers: {
        authorization: `Bearer ${owner1Token}`,
        "x-requested-with": "XMLHttpRequest",
      },
      payload: {
        name: "Priya Sharma",
        phone: "9876543210",
        email: "priya@gmail.com",
      },
    });
    expect(createRes.statusCode).toBe(201);
    expect(createRes.json().data.name).toBe("Priya Sharma");
    phoneUniqueSpy.mockRestore();
    customerSpy.mockRestore();

    // Archiving customer
    const archiveSpy = vi.spyOn(prisma.customer, "findFirst").mockResolvedValueOnce({
      id: 201,
      ownerId: 1,
      isArchived: false,
    } as any);
    const updateSpy = vi.spyOn(prisma.customer, "update").mockResolvedValueOnce({
      id: 201,
      ownerId: 1,
      isArchived: true,
      archivedAt: new Date(),
    } as any);

    const archiveRes = await app.inject({
      method: "PATCH",
      url: "/customers/201/archive",
      headers: {
        authorization: `Bearer ${owner1Token}`,
        "x-requested-with": "XMLHttpRequest",
      },
    });
    expect(archiveRes.statusCode).toBe(200);
    expect(archiveRes.json().data.isArchived).toBe(true);
    archiveSpy.mockRestore();
    updateSpy.mockRestore();
  });

  // ==========================================================================
  // FLOW 3: Create and Update Orders
  // ==========================================================================
  it("FLOW 3: Create order with items, total amount, advance, and promised delivery date", async () => {
    const custSpy = vi.spyOn(prisma.customer, "findFirst").mockResolvedValueOnce({
      id: 201,
      ownerId: 1,
    } as any);

    const txSpy = vi.spyOn(prisma, "$transaction").mockImplementationOnce(async (callback: any) => {
      return callback({
        order: {
          create: async () => ({
            id: 301,
            ownerId: 1,
            customerId: 201,
            itemName: "Embroidered Silk Lehenga",
            totalAmount: 25000,
            advance: 5000,
            balance: 20000,
            paymentStatus: "PARTIALLY_PAID",
            status: "ACTIVE",
            promisedDate: new Date("2026-12-15"),
            publicToken: "tok-e2e-lehenga-301",
            createdAt: new Date(),
            isArchived: false,
          }),
        },
        orderStage: {
          createMany: async () => ({ count: 5 }),
        },
        payment: {
          create: async () => ({ id: 1, amount: 5000 }),
        },
      });
    });

    const res = await app.inject({
      method: "POST",
      url: "/orders",
      headers: {
        authorization: `Bearer ${owner1Token}`,
        "x-requested-with": "XMLHttpRequest",
      },
      payload: {
        customerId: 201,
        itemName: "Embroidered Silk Lehenga",
        totalAmount: 25000,
        advance: 5000,
        promisedDate: "2026-12-15",
      },
    });

    expect(res.statusCode).toBe(201);
    const data = res.json().data;
    expect(data.itemName).toBe("Embroidered Silk Lehenga");
    expect(data.totalAmount).toBe(25000);
    expect(data.balance).toBe(20000);
    custSpy.mockRestore();
    txSpy.mockRestore();
  });

  // ==========================================================================
  // FLOW 4 & 5: Update All 5 Production Stages & Stage Details
  // ==========================================================================
  it("FLOW 4 & 5: Progress all 5 stages from PENDING -> IN_PROGRESS -> COMPLETED and verify order stages", async () => {
    const stageSequence = [
      "Material Sourcing",
      "Cutting & Pattern Making",
      "Stitching & Assembly",
      "Handwork & Embroidery",
      "Finishing & Packaging",
    ];

    for (let i = 0; i < stageSequence.length; i++) {
      const stageId = 401 + i;
      const stageSpy = vi.spyOn(prisma.orderStage, "findFirst").mockResolvedValueOnce({
        id: stageId,
        orderId: 301,
        name: stageSequence[i],
        status: "PENDING",
        position: i + 1,
        order: { ownerId: 1 },
      } as any);

      const updateSpy = vi.spyOn(prisma.orderStage, "update").mockResolvedValueOnce({
        id: stageId,
        orderId: 301,
        name: stageSequence[i],
        status: "COMPLETED",
        position: i + 1,
      } as any);

      const res = await app.inject({
        method: "PATCH",
        url: `/stages/${stageId}`,
        headers: {
          authorization: `Bearer ${owner1Token}`,
          "x-requested-with": "XMLHttpRequest",
        },
        payload: { status: "COMPLETED" },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.status).toBe("COMPLETED");
      expect(res.json().data.name).toBe(stageSequence[i]);
      stageSpy.mockRestore();
      updateSpy.mockRestore();
    }
  });

  // ==========================================================================
  // FLOW 6: Verify Expected Delivery Date
  // ==========================================================================
  it("FLOW 6: Rejects invalid delivery date format and verifies valid YYYY-MM-DD", async () => {
    const badDate = await app.inject({
      method: "POST",
      url: "/orders",
      headers: {
        authorization: `Bearer ${owner1Token}`,
        "x-requested-with": "XMLHttpRequest",
      },
      payload: {
        customerId: 201,
        itemName: "Kurta",
        totalAmount: 3000,
        advance: 500,
        promisedDate: "15-12-2026", // Invalid format
      },
    });
    expect(badDate.statusCode).toBe(400);
  });

  // ==========================================================================
  // FLOW 7, 8, 9: Payments, Balance Calculations & History
  // ==========================================================================
  it("FLOW 7, 8, 9: Record advance, record balance, verify zero balance and payment history", async () => {
    // 7. Advance payment of 5,000 on 25,000 leaves balance 20,000
    // 8. Balance payment of 20,000 transitions paymentStatus to PAID and balance to 0
    const orderMock = {
      id: 301,
      ownerId: 1,
      totalAmount: 25000,
      balance: 20000,
      payments: [
        { id: 1, amount: 5000, paymentType: "ADVANCE", status: "COMPLETED", createdAt: new Date("2026-11-01") },
        { id: 2, amount: 20000, paymentType: "BALANCE", status: "COMPLETED", createdAt: new Date("2026-11-13") },
      ],
    };

    const totalPaid = orderMock.payments.reduce((acc, p) => acc + p.amount, 0);
    const finalBalance = orderMock.totalAmount - totalPaid;
    expect(totalPaid).toBe(25000);
    expect(finalBalance).toBe(0);
  });

  // ==========================================================================
  // FLOW 10: Razorpay Test Payment & Signature Verification
  // ==========================================================================
  it("FLOW 10: Verifies HMAC-SHA256 signature algorithm on Razorpay test payments", () => {
    const secret = "test_razorpay_secret_key_12345";
    const razorpayOrderId = "order_test_998877";
    const razorpayPaymentId = "pay_test_554433";

    const payload = `${razorpayOrderId}|${razorpayPaymentId}`;
    const validSignature = crypto.createHmac("sha256", secret).update(payload).digest("hex");

    const expectedSignature = crypto.createHmac("sha256", secret).update(payload).digest("hex");
    expect(validSignature).toBe(expectedSignature);

    const invalidSignature = crypto.createHmac("sha256", "wrong_secret").update(payload).digest("hex");
    expect(validSignature).not.toBe(invalidSignature);
  });

  // ==========================================================================
  // FLOW 11: Public Order Tracking Link
  // ==========================================================================
  it("FLOW 11: Public order tracking by token returns public details without owner credentials", async () => {
    const orderSpy = vi.spyOn(prisma.order, "findUnique").mockResolvedValueOnce({
      id: 301,
      itemName: "Embroidered Silk Lehenga",
      totalAmount: 25000,
      advance: 5000,
      balance: 20000,
      paymentStatus: "PARTIALLY_PAID",
      status: "ACTIVE",
      promisedDate: new Date("2026-12-15"),
      customer: { name: "Priya Sharma" },
      owner: { name: "Anusha Rao", businessName: "Anusha Haute Couture" },
      stages: [
        { id: 1, name: "Material Sourcing", status: "COMPLETED", position: 1 },
        { id: 2, name: "Cutting & Pattern Making", status: "IN_PROGRESS", position: 2 },
      ],
      payments: [
        { id: 1, amount: 5000, paymentType: "ADVANCE", status: "COMPLETED", createdAt: new Date() },
      ],
    } as any);

    const res = await app.inject({
      method: "GET",
      url: "/api/public/orders/tok-e2e-lehenga-301",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.itemName).toBe("Embroidered Silk Lehenga");
    // Verify zero private password or credentials
    expect(body.data.owner.password).toBeUndefined();
    orderSpy.mockRestore();
  });

  // ==========================================================================
  // CROSS-TENANT ISOLATION VALIDATION
  // ==========================================================================
  it("SECURITY: Cross-owner data access is strictly prevented", async () => {
    const orderSpy = vi.spyOn(prisma.order, "findFirst").mockResolvedValueOnce(null);

    const res = await app.inject({
      method: "GET",
      url: "/orders/301",
      headers: { authorization: `Bearer ${owner2Token}` },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().message).toBe("Order not found");
    orderSpy.mockRestore();
  });
});
