import { describe, it, expect, beforeAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifyJwt from "@fastify/jwt";
import prisma from "./lib/prisma.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { customerRoutes } from "./modules/customers/customer.routes.js";
import { orderRoutes } from "./modules/orders/order.routes.js";
import { stageRoutes } from "./modules/stages/stage.routes.js";
import { paymentRoutes } from "./modules/payments/payment.routes.js";
import { dashboardRoutes } from "./modules/dashboard/dashboard.routes.js";
import { publicRoutes } from "./modules/public/public.routes.js";

describe("Advance Pay — Multi-Tenant Isolation & Security Test Suite", () => {
  let app: FastifyInstance;

  // Tenant A: Boutique A
  const ownerAEmail = `owner_a_${Date.now()}_${Math.random().toString(36).substring(7)}@boutique-a.com`;
  const ownerAPhone = `91${Math.floor(10000000 + Math.random() * 90000000)}`;
  let ownerAToken: string;
  let ownerACookie: string;
  let ownerAId: number;

  // Tenant B: Boutique B
  const ownerBEmail = `owner_b_${Date.now()}_${Math.random().toString(36).substring(7)}@boutique-b.com`;
  const ownerBPhone = `92${Math.floor(10000000 + Math.random() * 90000000)}`;
  let ownerBToken: string;
  let ownerBCookie: string;
  let ownerBId: number;

  // Shared customer phone number to verify tenant scoping
  const sharedCustomerPhone = `98${Math.floor(10000000 + Math.random() * 90000000)}`;
  let customerAId: number;
  let customerBId: number;

  // Orders
  let orderAId: number;
  let orderAPublicToken: string;
  let orderBId: number;

  beforeAll(async () => {
    app = Fastify();
    await app.register(fastifyCookie);
    await app.register(fastifyJwt, {
      secret: "super_secure_multi_tenant_jwt_secret_with_32_characters_minimum",
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
    await app.register(customerRoutes);
    await app.register(orderRoutes);
    await app.register(stageRoutes);
    await app.register(paymentRoutes);
    await app.register(dashboardRoutes);
    await app.register(publicRoutes);
    await app.ready();
  });

  // --------------------------------------------------------------------------
  // 1. Independent Owner Registration
  // --------------------------------------------------------------------------
  it("Requirement 1 & 2: Multiple owners register and log in independently without first-owner lock", async () => {
    // Register Owner A
    const regARes = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        name: "Aaditi Sharma",
        email: ownerAEmail,
        phone: ownerAPhone,
        businessName: "Aaditi Couture",
        password: "Password123!",
        confirmPassword: "Password123!",
      },
    });
    expect(regARes.statusCode).toBe(201);
    expect(regARes.json().success).toBe(true);

    // Register Owner B (Must succeed; single-owner lock must not block it)
    const regBRes = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        name: "Bhavna Patel",
        email: ownerBEmail,
        phone: ownerBPhone,
        businessName: "Bhavna Designs",
        password: "Password123!",
        confirmPassword: "Password123!",
      },
    });
    expect(regBRes.statusCode).toBe(201);
    expect(regBRes.json().success).toBe(true);

    // Login Owner A
    const loginARes = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email: ownerAEmail,
        password: "Password123!",
      },
    });
    expect(loginARes.statusCode).toBe(200);
    ownerAId = loginARes.json().data.id;
    const cookieAHeader = loginARes.headers["set-cookie"];
    ownerACookie = Array.isArray(cookieAHeader) ? cookieAHeader[0]! : String(cookieAHeader);
    const tokenAMatch = ownerACookie.match(/token=([^;]+)/);
    ownerAToken = tokenAMatch ? tokenAMatch[1]! : "";

    // Login Owner B
    const loginBRes = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email: ownerBEmail,
        password: "Password123!",
      },
    });
    expect(loginBRes.statusCode).toBe(200);
    ownerBId = loginBRes.json().data.id;
    const cookieBHeader = loginBRes.headers["set-cookie"];
    ownerBCookie = Array.isArray(cookieBHeader) ? cookieBHeader[0]! : String(cookieBHeader);
    const tokenBMatch = ownerBCookie.match(/token=([^;]+)/);
    ownerBToken = tokenBMatch ? tokenBMatch[1]! : "";

    expect(ownerAId).not.toBe(ownerBId);
  });

  // --------------------------------------------------------------------------
  // 2. Tenant-Scoped Customer Creation (Same phone allowed across tenants)
  // --------------------------------------------------------------------------
  it("Requirement 6: Allows same customer phone number for different owners, but rejects within same owner", async () => {
    // Owner A creates customer with sharedCustomerPhone
    const custARes = await app.inject({
      method: "POST",
      url: "/customers",
      headers: {
        authorization: `Bearer ${ownerAToken}`,
      },
      payload: {
        name: "Pooja Hegde (Client of A)",
        phone: sharedCustomerPhone,
        email: "pooja.client@example.com",
      },
    });
    expect(custARes.statusCode).toBe(201);
    customerAId = custARes.json().data.id;

    // Owner B creates customer with IDENTICAL sharedCustomerPhone (Must succeed!)
    const custBRes = await app.inject({
      method: "POST",
      url: "/customers",
      headers: {
        authorization: `Bearer ${ownerBToken}`,
      },
      payload: {
        name: "Pooja Hegde (Client of B)",
        phone: sharedCustomerPhone,
        email: "pooja.b@example.com",
      },
    });
    expect(custBRes.statusCode).toBe(201);
    customerBId = custBRes.json().data.id;
    expect(customerAId).not.toBe(customerBId);

    // Owner A attempts duplicate customer with same phone (Must be rejected with 409 Conflict)
    const dupRes = await app.inject({
      method: "POST",
      url: "/customers",
      headers: {
        authorization: `Bearer ${ownerAToken}`,
      },
      payload: {
        name: "Pooja Duplicate",
        phone: sharedCustomerPhone,
      },
    });
    expect(dupRes.statusCode).toBe(409);
    expect(dupRes.json().message).toContain("already exists");
  });

  // --------------------------------------------------------------------------
  // 3. Customer Listing Isolation
  // --------------------------------------------------------------------------
  it("Requirement 4 & 5: Customer list returns only the authenticated owner's customers", async () => {
    const listA = await app.inject({
      method: "GET",
      url: "/customers",
      headers: { authorization: `Bearer ${ownerAToken}` },
    });
    expect(listA.statusCode).toBe(200);
    const customersA = listA.json().data;
    expect(customersA.some((c: any) => c.id === customerAId)).toBe(true);
    expect(customersA.some((c: any) => c.id === customerBId)).toBe(false);

    const listB = await app.inject({
      method: "GET",
      url: "/customers",
      headers: { authorization: `Bearer ${ownerBToken}` },
    });
    expect(listB.statusCode).toBe(200);
    const customersB = listB.json().data;
    expect(customersB.some((c: any) => c.id === customerBId)).toBe(true);
    expect(customersB.some((c: any) => c.id === customerAId)).toBe(false);
  });

  // --------------------------------------------------------------------------
  // 4. Order Creation and Composite Tenant Integrity
  // --------------------------------------------------------------------------
  it("Requirement 3 & 5: Orders are associated with owner and reject cross-tenant customer linkage", async () => {
    // Owner A creates order for customer A
    const orderARes = await app.inject({
      method: "POST",
      url: "/orders",
      headers: { authorization: `Bearer ${ownerAToken}` },
      payload: {
        customerId: customerAId,
        itemName: "Bridal Lehenga Couture A",
        totalAmount: 50000,
        advance: 15000,
        promisedDate: "2026-12-25",
        stages: ["Design", "Embroidery", "Final Stitch"],
      },
    });
    expect(orderARes.statusCode).toBe(201);
    orderAId = orderARes.json().data.id;
    orderAPublicToken = orderARes.json().data.publicToken;

    // Owner B creates order for customer B
    const orderBRes = await app.inject({
      method: "POST",
      url: "/orders",
      headers: { authorization: `Bearer ${ownerBToken}` },
      payload: {
        customerId: customerBId,
        itemName: "Silk Anarkali B",
        totalAmount: 20000,
        advance: 5000,
        promisedDate: "2026-12-30",
      },
    });
    expect(orderBRes.statusCode).toBe(201);
    orderBId = orderBRes.json().data.id;

    // Cross-tenant attack: Owner B attempts to create an order using customerAId (belongs to Owner A)
    const crossOrderRes = await app.inject({
      method: "POST",
      url: "/orders",
      headers: { authorization: `Bearer ${ownerBToken}` },
      payload: {
        customerId: customerAId, // belongs to Owner A!
        itemName: "Illegitimate Order",
        totalAmount: 10000,
        advance: 2000,
        promisedDate: "2026-12-31",
      },
    });
    expect(crossOrderRes.statusCode).toBe(404);
    expect(crossOrderRes.json().message).toContain("Customer not found");
  });

  // --------------------------------------------------------------------------
  // 5. Cross-Tenant Direct Foreign Key Rejection at DB Engine Level
  // --------------------------------------------------------------------------
  it("Requirement 5: PostgreSQL composite foreign key rejects cross-tenant insertion directly at DB level", async () => {
    // Direct SQL insert bypassing application validation
    let dbError: any = null;
    try {
      await prisma.$executeRaw`
        INSERT INTO "Order" ("ownerId", "customerId", "itemName", "totalAmount", "advance", "balance", "paymentStatus", "publicToken", "createdAt")
        VALUES (${ownerBId}, ${customerAId}, 'Direct SQL Attack', 10000, 2000, 8000, 'PENDING', ${'attack-token-' + Date.now()}, NOW())
      `;
    } catch (err: any) {
      dbError = err;
    }

    expect(dbError).not.toBeNull();
    // Detail must confirm foreign key constraint violation on Order_customerId_ownerId_fkey
    expect(String(dbError)).toContain("Order_customerId_ownerId_fkey");
  });

  // --------------------------------------------------------------------------
  // 6. Cross-Tenant Order, Payment, and Stage Access Rejection
  // --------------------------------------------------------------------------
  it("Requirement 4 & 7: Rejects cross-tenant access to orders, payments, and order stages", async () => {
    // Owner B attempts to view Owner A's order
    const viewRes = await app.inject({
      method: "GET",
      url: `/orders/${orderAId}`,
      headers: { authorization: `Bearer ${ownerBToken}` },
    });
    expect(viewRes.statusCode).toBe(404);

    // Owner B attempts to view payments for Owner A's order
    const payListRes = await app.inject({
      method: "GET",
      url: `/orders/${orderAId}/payments`,
      headers: { authorization: `Bearer ${ownerBToken}` },
    });
    expect(payListRes.statusCode).toBe(404);

    // Owner B attempts to record a cash payment on Owner A's order
    const payMutateRes = await app.inject({
      method: "POST",
      url: `/orders/${orderAId}/payments`,
      headers: { authorization: `Bearer ${ownerBToken}` },
      payload: {
        amount: 5000,
        paymentType: "BALANCE",
      },
    });
    expect(payMutateRes.statusCode).toBe(404);

    // Fetch stages of Order A as Owner A
    const stagesA = await prisma.orderStage.findMany({ where: { orderId: orderAId } });
    const stageAId = stagesA[0]!.id;

    // Owner B attempts to update stage status of Owner A's order
    const patchStageRes = await app.inject({
      method: "PATCH",
      url: `/stages/${stageAId}`,
      headers: { authorization: `Bearer ${ownerBToken}` },
      payload: {
        status: "COMPLETED",
      },
    });
    expect(patchStageRes.statusCode).toBe(404);
  });

  // --------------------------------------------------------------------------
  // 7. Dashboard Calculation Isolation & Accuracy
  // --------------------------------------------------------------------------
  it("Requirement 7: Dashboard statistics are strictly isolated and accurately calculated per owner", async () => {
    // Record cash payment on Owner A's order: 10,000 balance payment
    const cashRes = await app.inject({
      method: "POST",
      url: `/orders/${orderAId}/payments`,
      headers: { authorization: `Bearer ${ownerAToken}` },
      payload: {
        amount: 10000,
        paymentType: "BALANCE",
      },
    });
    expect(cashRes.statusCode).toBe(201);

    // Owner A's dashboard
    const dashARes = await app.inject({
      method: "GET",
      url: "/dashboard/stats",
      headers: { authorization: `Bearer ${ownerAToken}` },
    });
    expect(dashARes.statusCode).toBe(200);
    const statsA = dashARes.json().data;
    expect(statsA.totalOrders).toBe(1);
    expect(statsA.totalCustomers).toBe(1);
    expect(statsA.totalOrderValue).toBe(50000);
    expect(statsA.totalCollected).toBe(10000); // 10,000 cash payment completed
    expect(statsA.totalOutstanding).toBe(40000); // 50,000 initial balance - 10,000 cash payment = 40,000

    // Owner B's dashboard (Must reflect ONLY Owner B's activity)
    const dashBRes = await app.inject({
      method: "GET",
      url: "/dashboard/stats",
      headers: { authorization: `Bearer ${ownerBToken}` },
    });
    expect(dashBRes.statusCode).toBe(200);
    const statsB = dashBRes.json().data;
    expect(statsB.totalOrders).toBe(1);
    expect(statsB.totalCustomers).toBe(1);
    expect(statsB.totalOrderValue).toBe(20000);
    expect(statsB.totalCollected).toBe(0); // zero completed payments recorded on order B
    expect(statsB.totalOutstanding).toBe(20000); // 20,000 initial balance without payments
  }, 15000);

  // --------------------------------------------------------------------------
  // 8. Public Order Tracking & Tenant Branding
  // --------------------------------------------------------------------------
  it("Requirement 8: Public tracking URL resolves correctly and includes owner boutique branding", async () => {
    const publicRes = await app.inject({
      method: "GET",
      url: `/api/public/orders/${orderAPublicToken}`,
    });
    expect(publicRes.statusCode).toBe(200);
    const orderData = publicRes.json().data;
    expect(orderData.itemName).toBe("Bridal Lehenga Couture A");
    expect(orderData.owner.businessName).toBe("Aaditi Couture");
    expect(orderData.owner.name).toBe("Aaditi Sharma");
  });
});
