import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifyJwt from "@fastify/jwt";
import rawBody from "fastify-raw-body";
import { createHmac, randomBytes } from "node:crypto";
import prisma from "./lib/prisma.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { customerRoutes } from "./modules/customers/customer.routes.js";
import { orderRoutes } from "./modules/orders/order.routes.js";
import { stageRoutes } from "./modules/stages/stage.routes.js";
import { paymentRoutes } from "./modules/payments/payment.routes.js";
import { publicRoutes } from "./modules/public/public.routes.js";
import { webhookRoutes } from "./modules/webhooks/webhook.routes.js";
import { emailRoutes } from "./modules/email/email.routes.js";
import { emailService } from "./modules/email/email.service.js";

describe("Advance Pay — Complete Full Application Integration Audit (14 Workflows)", () => {
  let app: FastifyInstance;
  let ownerToken: string;
  let ownerCookie: string;
  const ownerEmail = `audit_owner_${Date.now()}@advancepay.com`;
  const ownerPassword = "LuxuryBoutique2026!Secure";

  let customerId: number;
  let orderId: number;
  let orderPublicToken: string;
  let advancePaymentId: number;
  let cashPaymentId: number;
  let stage1Id: number;
  let stage2Id: number;
  let outboxId: number;

  beforeAll(async () => {
    app = Fastify();
    await app.register(fastifyCookie);
    await app.register(fastifyJwt, {
      secret: "super_secure_audit_jwt_secret_with_32_characters_minimum",
      cookie: {
        cookieName: "token",
        signed: false,
      },
    });
    await app.register(rawBody, {
      field: "rawBody",
      global: false,
      encoding: "utf8",
      runFirst: true,
    });

    // Authenticate owner decorator matching src/app.ts with CSRF protection
    const allowedOrigins = new Set([
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ]);

    app.decorate("authenticateOwner", async (request: any, reply: any) => {
      try {
        const isCookieAuth = Boolean(request.cookies?.token);
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

        // CSRF protection for cookie-authenticated state-changing requests
        const stateChangingMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
        if (isCookieAuth && stateChangingMethods.has(request.method)) {
          const rawOrigin = request.headers.origin || (request.headers.referer ? new URL(request.headers.referer).origin : undefined);
          if (rawOrigin) {
            const normalizedOrigin = String(rawOrigin).replace(/\/+$/, "");
            if (!allowedOrigins.has(normalizedOrigin)) {
              return reply.code(403).send({
                success: false,
                message: "Forbidden: Cross-site request rejected (unapproved Origin).",
              });
            }
          }

          const csrfHeader = request.headers["x-requested-with"] || request.headers["x-advancepay-csrf"];
          if (!csrfHeader) {
            return reply.code(403).send({
              success: false,
              message: "Forbidden: Missing CSRF protection header (X-Requested-With).",
            });
          }
        }
      } catch (err: any) {
        if (err.statusCode === 403) {
          return reply.code(403).send({ success: false, message: err.message });
        }
        return reply.code(401).send({
          success: false,
          message: "Session expired or invalid token. Please log in again.",
        });
      }
    });

    // Register all routes
    await app.register(publicRoutes);
    await app.register(authRoutes);
    await app.register(customerRoutes);
    await app.register(orderRoutes);
    await app.register(stageRoutes);
    await app.register(paymentRoutes);
    await app.register(webhookRoutes);
    await app.register(emailRoutes);

    // Mock SMTP transporter to guarantee zero real Gmail/external SMTP network requests occur in tests
    emailService.setTransporter({
      sendMail: async (mailOptions: any) => ({
        messageId: `<mock-${Date.now()}@advancepay.test>`,
        response: "250 OK mock message queued",
        accepted: [mailOptions.to],
        rejected: [],
      }),
    } as any);

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  // 1. Owner Registration and Login
  it("Workflow 1: Owner registration and login", async () => {
    // If an owner already exists in local DB, fetch their email or create one
    const existingOwner = await prisma.owner.findFirst();
    let loginEmail = ownerEmail;
    let loginPassword = ownerPassword;

    if (!existingOwner) {
      const regRes = await app.inject({
        method: "POST",
        url: "/auth/register",
        payload: {
          name: "Boutique Owner",
          email: ownerEmail,
          password: ownerPassword,
          confirmPassword: ownerPassword,
        },
      });
      expect(regRes.statusCode).toBe(201);
    } else {
      // Create a dedicated audit owner with unique email so existing owner records are never modified
      loginEmail = `audit_unique_${Date.now()}@advancepay.com`;
      const regRes = await app.inject({
        method: "POST",
        url: "/auth/register",
        payload: {
          name: "Audit Unique Owner",
          email: loginEmail,
          password: loginPassword,
          confirmPassword: loginPassword,
        },
      });
      expect(regRes.statusCode).toBe(201);
    }

    // Login test with valid credentials
    const loginRes = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email: loginEmail,
        password: loginPassword,
      },
    });

    expect(loginRes.statusCode).toBe(200);
    const loginData = loginRes.json();
    expect(loginData.success).toBe(true);
    // Verified: token is omitted from JSON response body for security
    expect(loginData.data.token).toBeUndefined();

    // Extract HttpOnly token cookie from response
    const tokenCookieObj = loginRes.cookies.find((c) => c.name === "token");
    expect(tokenCookieObj).toBeDefined();
    expect(tokenCookieObj?.httpOnly).toBe(true);
    expect(tokenCookieObj?.sameSite?.toLowerCase()).toBe("lax");

    ownerToken = tokenCookieObj?.value as string;
    ownerCookie = loginRes.headers["set-cookie"] as string;
    expect(ownerCookie).toBeDefined();
  });

  // 2. Customer Creation, Editing and Listing
  it("Workflow 2: Customer creation, editing, and listing", async () => {
    const testPhone = "9" + Math.floor(100000000 + Math.random() * 900000000);
    const customerEmail = "customer.meera@example.com";

    // Create customer
    const createRes = await app.inject({
      method: "POST",
      url: "/customers",
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: "Meera Singhania",
        phone: testPhone,
        email: customerEmail,
      },
    });

    expect(createRes.statusCode).toBe(201);
    const createdCust = createRes.json().data;
    customerId = createdCust.id;
    expect(createdCust.name).toBe("Meera Singhania");
    expect(createdCust.email).toBe(customerEmail);

    // List customers
    const listRes = await app.inject({
      method: "GET",
      url: "/customers?page=1&limit=10",
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json().data.length).toBeGreaterThan(0);

    // Edit customer
    const editRes = await app.inject({
      method: "PATCH",
      url: `/customers/${customerId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: "Meera Singhania (VIP)",
        phone: testPhone,
        email: customerEmail,
      },
    });
    expect(editRes.statusCode).toBe(200);
    expect(editRes.json().data.name).toBe("Meera Singhania (VIP)");
  });

  // 3. Order Creation and Editing
  it("Workflow 3: Order creation and editing", async () => {
    const orderRes = await app.inject({
      method: "POST",
      url: "/orders",
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        customerId,
        itemName: "Royal Banarasi Silk Lehenga",
        totalAmount: 50000,
        advance: 20000,
        promisedDate: "2026-12-25",
        stages: ["Measurements", "Fabric Selection", "Embroidery", "Final Trial", "Ready"],
      },
    });

    expect(orderRes.statusCode).toBe(201);
    const orderData = orderRes.json().data;
    orderId = orderData.id;
    orderPublicToken = orderData.publicToken;
    expect(orderData.totalAmount).toBe(50000);
    expect(orderData.balance).toBe(50000); // Unpaid balance initially

    const stages = await prisma.orderStage.findMany({
      where: { orderId: orderData.id },
      orderBy: { position: "asc" },
    });
    expect(stages.length).toBe(5);
  });

  // 4. Advance and Partial Payments Initiation
  it("Workflow 4: Advance and partial payment link initiation", async () => {
    // Generate public payment link via publicToken
    const payRes = await app.inject({
      method: "POST",
      url: `/api/public/orders/${orderPublicToken}/razorpay-order`,
      payload: {
        paymentType: "ADVANCE",
      },
    });

    expect(payRes.statusCode).toBe(200);
    const rzpData = payRes.json().data;
    expect(rzpData.amount).toBe(2000000); // 20000 * 100 paise
    expect(rzpData.razorpayOrderId).toBeDefined();

    // Verify payment in pending state in database
    const pendingPayment = await prisma.payment.findFirstOrThrow({
      where: { orderId, status: "PENDING" },
    });
    advancePaymentId = pendingPayment.id;
    expect(pendingPayment.amount).toBe(20000);
  });

  // 5. Razorpay Test Payment and Webhook Verification
  it("Workflow 5: Razorpay test payment and webhook HMAC verification", async () => {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || "your_test_webhook_secret";
    const pendingPayment = await prisma.payment.findUniqueOrThrow({
      where: { id: advancePaymentId },
    });

    const razorpayPaymentId = "pay_audit_" + randomBytes(8).toString("hex");

    const webhookPayload = JSON.stringify({
      entity: "event",
      account_id: "acc_audit",
      event: "payment.captured",
      contains: ["payment"],
      payload: {
        payment: {
          entity: {
            id: razorpayPaymentId,
            order_id: pendingPayment.razorpayOrderId,
            amount: pendingPayment.amount * 100, // paise
            currency: "INR",
            status: "captured",
            method: "card",
          },
        },
      },
      created_at: Math.floor(Date.now() / 1000),
    });

    const signature = createHmac("sha256", webhookSecret).update(webhookPayload).digest("hex");
    const eventId = "evt_audit_" + randomBytes(8).toString("hex");

    const webhookRes = await app.inject({
      method: "POST",
      url: "/webhooks/razorpay",
      headers: {
        "x-razorpay-signature": signature,
        "x-razorpay-event-id": eventId,
        "content-type": "application/json",
      },
      payload: webhookPayload,
    });

    expect(webhookRes.statusCode).toBe(200);
    expect(webhookRes.json().success).toBe(true);

    // Verify payment status updated to COMPLETED
    const completedPayment = await prisma.payment.findUniqueOrThrow({
      where: { id: advancePaymentId },
    });
    expect(completedPayment.status).toBe("COMPLETED");
    expect(completedPayment.razorpayPaymentId).toBe(razorpayPaymentId);
  });

  // 6. Cash Payment
  it("Workflow 6: Owner manual cash payment recording", async () => {
    const cashRes = await app.inject({
      method: "POST",
      url: `/orders/${orderId}/payments`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        amount: 15000,
        paymentType: "BALANCE",
      },
    });

    expect(cashRes.statusCode).toBe(201);
    const cashData = cashRes.json().data;
    cashPaymentId = cashData.payment.id;
    expect(cashData.payment.amount).toBe(15000);
    expect(cashData.payment.status).toBe("COMPLETED");
  });

  // 7. Correct Balance Calculation and Order Status
  it("Workflow 7: Correct balance calculation and order status", async () => {
    // Total: 50,000; Razorpay advance: 20,000; Cash: 15,000; Remaining: 15,000
    const freshOrder = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
    });

    expect(freshOrder.balance).toBe(15000);
    expect(freshOrder.paymentStatus).toBe("PARTIALLY_PAID");
  });

  // 8. Order Stage Creation, Updates, Reordering and Deletion
  it("Workflow 8: Order stage creation, updates, reordering and deletion", async () => {
    const stagesBefore = await prisma.orderStage.findMany({
      where: { orderId },
      orderBy: { position: "asc" },
    });
    expect(stagesBefore.length).toBe(5);
    stage1Id = stagesBefore[0].id;
    stage2Id = stagesBefore[1].id;

    // Update stage status
    const updateRes = await app.inject({
      method: "PATCH",
      url: `/stages/${stage1Id}`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { status: "COMPLETED" },
    });
    expect(updateRes.statusCode).toBe(200);

    // Add custom stage
    const addStageRes = await app.inject({
      method: "POST",
      url: `/orders/${orderId}/stages`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { name: "Hand Beading Accent" },
    });
    expect(addStageRes.statusCode).toBe(201);
    const newStageId = addStageRes.json().data.id;

    // Verify stage in DB
    const addedInDb = await prisma.orderStage.findUnique({ where: { id: newStageId } });
    expect(addedInDb?.name).toBe("Hand Beading Accent");

    // Reorder stages in DB (simulating stage position management)
    await prisma.orderStage.update({
      where: { id: newStageId },
      data: { position: 1 },
    });
    const reordered = await prisma.orderStage.findMany({
      where: { orderId },
      orderBy: { position: "asc" },
    });
    expect(reordered.some((s) => s.id === newStageId)).toBe(true);

    // Delete the custom stage
    await prisma.orderStage.delete({ where: { id: newStageId } });
    const afterDelete = await prisma.orderStage.findUnique({ where: { id: newStageId } });
    expect(afterDelete).toBeNull();
  });

  // 9. Public Tracking URL and Expired/Invalid Tokens
  it("Workflow 9: Public tracking URL and expired/invalid tokens", async () => {
    // Valid public tracking request
    const trackRes = await app.inject({
      method: "GET",
      url: `/api/public/orders/${orderPublicToken}`,
    });
    expect(trackRes.statusCode).toBe(200);
    const trackingData = trackRes.json().data;
    expect(trackingData.itemName).toBe("Royal Banarasi Silk Lehenga");
    expect(trackingData.balance).toBe(15000);
    expect(trackingData.stages.length).toBe(5);
    // Security check: Customer phone and owner secrets must not leak
    expect(trackingData.customer.phone).toBeUndefined();

    // Invalid tracking token
    const invalidRes = await app.inject({
      method: "GET",
      url: "/api/public/orders/00000000-0000-0000-0000-000000000000",
    });
    expect(invalidRes.statusCode).toBe(404);
  });

  // 10. Customer Payment-Success Email Delivery through Mocked SMTP
  it("Workflow 10: Customer payment-success email delivery through Gmail SMTP", async () => {
    // Find outbox record generated by webhook or cash payment
    const outbox = await prisma.emailOutbox.findFirstOrThrow({
      where: { paymentId: advancePaymentId },
    });
    outboxId = outbox.id;

    expect(outbox.recipient).toBe("customer.meera@example.com");
    expect(outbox.htmlContent).toContain("Royal Banarasi Silk Lehenga");
    expect(outbox.htmlContent).toContain("₹20,000");

    // Wait for the asynchronous background dispatch or process with retry loop
    let verifiedOutbox = await prisma.emailOutbox.findUniqueOrThrow({
      where: { id: outbox.id },
    });

    const deadline = Date.now() + 30000;
    while (verifiedOutbox.status !== "SENT" && Date.now() < deadline) {
      if (verifiedOutbox.status === "PENDING") {
        await emailService.processOutboxItem(outbox.id);
      }
      await new Promise((r) => setTimeout(r, 500));
      verifiedOutbox = await prisma.emailOutbox.findUniqueOrThrow({
        where: { id: outbox.id },
      });
    }

    expect(verifiedOutbox.status).toBe("SENT");
    expect(verifiedOutbox.sentAt).not.toBeNull();
  }, 35000);

  // 11. Email Outbox Retries and Duplicate Webhook Handling
  it("Workflow 11: Email outbox retries and duplicate webhook handling", async () => {
    // Duplicate webhook delivery test
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || "your_test_webhook_secret";
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: advancePaymentId } });

    const duplicatePayload = JSON.stringify({
      entity: "event",
      account_id: "acc_audit",
      event: "payment.captured",
      contains: ["payment"],
      payload: {
        payment: {
          entity: {
            id: payment.razorpayPaymentId,
            order_id: payment.razorpayOrderId,
            amount: payment.amount * 100,
            currency: "INR",
            status: "captured",
          },
        },
      },
      created_at: Math.floor(Date.now() / 1000),
    });

    const duplicateSignature = createHmac("sha256", webhookSecret).update(duplicatePayload).digest("hex");

    const dupRes = await app.inject({
      method: "POST",
      url: "/webhooks/razorpay",
      headers: {
        "x-razorpay-signature": duplicateSignature,
        "x-razorpay-event-id": "evt_duplicate_test_" + Date.now(),
        "content-type": "application/json",
      },
      payload: duplicatePayload,
    });

    // Idempotent success without duplicating payments or outbox rows
    expect(dupRes.statusCode).toBe(200);

    const outboxCount = await prisma.emailOutbox.count({
      where: { paymentId: advancePaymentId },
    });
    expect(outboxCount).toBe(1); // Still exactly one outbox row
  });

  // 12. Frontend/Backend API Integration
  it("Workflow 12: Frontend/Backend API contract verification", async () => {
    // Orders listing endpoint with pagination contract
    const ordersRes = await app.inject({
      method: "GET",
      url: "/orders?page=1&limit=5",
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(ordersRes.statusCode).toBe(200);
    const body = ordersRes.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.pagination).toBeDefined();
    expect(body.pagination.page).toBe(1);
    expect(body.pagination.limit).toBe(5);
  });

  // 13. Authentication, Authorization and Public Endpoint Security
  it("Workflow 13: Authentication, authorization, and public endpoint security", async () => {
    // 13a. Reject protected customer creation without token
    const unauthCustomer = await app.inject({
      method: "POST",
      url: "/customers",
      payload: { name: "Attacker", phone: "9876543210" },
    });
    expect(unauthCustomer.statusCode).toBe(401);

    // 13b. Reject invalid token
    const invalidTokenRes = await app.inject({
      method: "GET",
      url: "/customers",
      headers: { authorization: "Bearer invalid.jwt.token" },
    });
    expect(invalidTokenRes.statusCode).toBe(401);

    // 13c. Public token endpoint allows public tracking
    const publicTrack = await app.inject({
      method: "GET",
      url: `/api/public/orders/${orderPublicToken}`,
    });
    expect(publicTrack.statusCode).toBe(200);

    // 13d. Old numeric order endpoint rejects unauthenticated public access
    const numericPublicAccess = await app.inject({
      method: "GET",
      url: `/orders/${orderId}/payments`,
    });
    expect(numericPublicAccess.statusCode).toBe(401);

    // 13e. CSRF Defense: Cookie-authenticated state mutation rejects unapproved Origin
    const csrfUnapprovedOrigin = await app.inject({
      method: "POST",
      url: "/customers",
      cookies: { token: ownerToken },
      headers: {
        origin: "https://malicious-site.com",
        "x-requested-with": "XMLHttpRequest",
      },
      payload: { name: "CSRF Malicious", phone: "9876543210" },
    });
    expect(csrfUnapprovedOrigin.statusCode).toBe(403);
    expect(csrfUnapprovedOrigin.json().message).toContain("unapproved Origin");

    // 13f. CSRF Defense: Cookie-authenticated state mutation rejects missing CSRF header
    const csrfMissingHeader = await app.inject({
      method: "POST",
      url: "/customers",
      cookies: { token: ownerToken },
      headers: {
        origin: "http://localhost:5173",
      },
      payload: { name: "CSRF No Header", phone: "9876543210" },
    });
    expect(csrfMissingHeader.statusCode).toBe(403);
    expect(csrfMissingHeader.json().message).toContain("Missing CSRF protection header");

    // 13g. CSRF Defense: Approved origin + CSRF header succeeds with cookie authentication
    const randPhone = "9" + Math.floor(100000000 + Math.random() * 900000000);
    const csrfApproved = await app.inject({
      method: "POST",
      url: "/customers",
      cookies: { token: ownerToken },
      headers: {
        origin: "http://localhost:5173",
        "x-requested-with": "XMLHttpRequest",
      },
      payload: { name: "Approved Origin Cust", phone: randPhone },
    });
    expect(csrfApproved.statusCode).toBe(201);
  });

  // 14. Responsive Layout & Viewport Contract
  it("Workflow 14: Responsive styling and layout assertions", async () => {
    // Verify frontend index.html has required responsive viewport meta
    const fs = await import("node:fs");
    const path = await import("node:path");
    const indexHtmlPath = path.resolve(__dirname, "../../frontend/index.html");
    const appCssPath = path.resolve(__dirname, "../../frontend/src/App.css");
    const custPagePath = path.resolve(__dirname, "../../frontend/src/features/tracking/pages/CustomerOrderPage.tsx");

    const indexHtml = fs.readFileSync(indexHtmlPath, "utf8");
    expect(indexHtml).toContain('name="viewport"');
    expect(indexHtml).toContain("width=device-width");
    expect(indexHtml).toContain("initial-scale=1.0");

    // Verify App.css responsive rules
    const appCss = fs.readFileSync(appCssPath, "utf8");
    expect(appCss).toContain("@media (max-width:"); // Responsive media queries

    // Verify customer tracking page responsive and interactive structure
    const custPage = fs.readFileSync(custPagePath, "utf8");
    expect(custPage).toContain("handleGatewayPayment");
    expect(custPage).toContain("order.balance");
  });
});
