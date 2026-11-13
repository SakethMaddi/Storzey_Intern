import { createHmac } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import rawBody from "fastify-raw-body";
import { paymentRoutes } from "./modules/payments/payment.routes.js";
import { webhookRoutes } from "./modules/webhooks/webhook.routes.js";

const KEY_SECRET = "test_key_secret_value";
const WEBHOOK_SECRET = "test_webhook_secret_value";

class Mutex {
  private chain: Promise<void> = Promise.resolve();

  acquire(): Promise<() => void> {
    let release!: () => void;
    const next = new Promise<void>((resolve) => {
      release = resolve;
    });
    const previous = this.chain;
    this.chain = previous.then(() => next);
    return previous.then(() => () => release());
  }
}

interface MemoryPayment {
  id: number;
  orderId: number;
  amount: number;
  status: string;
  razorpayOrderId: string;
  razorpayPaymentId: string | null;
  paymentType: string;
}

interface MemoryOrder {
  id: number;
  ownerId: number;
  balance: number;
  paymentStatus: string;
  paymentLinkExpiresAt: Date | null;
  totalAmount: number;
  itemName: string;
  customerId: number;
}

const h = vi.hoisted(() => {
  const state = {
    payments: [] as MemoryPayment[],
    orders: [] as MemoryOrder[],
    events: [] as string[],
    decrements: 0,
    release: null as (() => void) | null,
  };
  return {
    state,
    mutex: null as Mutex | null,
    fetchMock: vi.fn(),
    enqueue: vi.fn(),
  };
});

function resetState() {
  h.state.payments = [
    {
      id: 1,
      orderId: 10,
      amount: 400,
      status: "PENDING",
      razorpayOrderId: "order_test_1",
      razorpayPaymentId: null,
      paymentType: "BALANCE",
    },
  ];
  h.state.orders = [
    {
      id: 10,
      ownerId: 3,
      balance: 1000,
      paymentStatus: "PENDING",
      paymentLinkExpiresAt: null,
      totalAmount: 1000,
      itemName: "Blouse",
      customerId: 8,
    },
    {
      id: 11,
      ownerId: 4,
      balance: 5000,
      paymentStatus: "PENDING",
      paymentLinkExpiresAt: null,
      totalAmount: 5000,
      itemName: "Other tenant",
      customerId: 9,
    },
  ];
  h.state.events = [];
  h.state.decrements = 0;
  h.state.release = null;
  h.mutex = new Mutex();
  h.fetchMock.mockReset();
  h.enqueue.mockReset();
  h.enqueue.mockResolvedValue({ status: "ENQUEUED" });
  h.fetchMock.mockResolvedValue({
    id: "pay_test_1",
    order_id: "order_test_1",
    status: "captured",
    currency: "INR",
    amount: 40000,
  });
}

function makeTx() {
  return {
    webhookEvent: {
      create: async ({ data }: { data: { eventId: string } }) => {
        if (h.state.events.includes(data.eventId)) {
          const error = new Error("unique") as Error & { code: string };
          error.code = "P2002";
          throw error;
        }
        h.state.events.push(data.eventId);
      },
    },
    $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = strings.join(" ");
      if (!sql.includes("FOR UPDATE")) {
        throw new Error("payment row was read without FOR UPDATE");
      }
      const unlock = await h.mutex!.acquire();
      h.state.release = unlock;
      const razorpayOrderId = String(values[0]);
      const payment = h.state.payments.find((item) => item.razorpayOrderId === razorpayOrderId);
      const order = h.state.orders.find((item) => item.id === payment?.orderId);
      if (!payment || !order) return [];
      return [
        {
          paymentId: payment.id,
          orderId: order.id,
          amount: payment.amount,
          status: payment.status,
          paymentType: payment.paymentType,
          razorpayPaymentId: payment.razorpayPaymentId,
          ownerId: order.ownerId,
          balance: order.balance,
          paymentStatus: order.paymentStatus,
          paymentLinkExpiresAt: order.paymentLinkExpiresAt,
          totalAmount: order.totalAmount,
          itemName: order.itemName,
          customerEmail: order.ownerId === 3 ? "secret-customer@example.com" : "other@example.com",
          customerName: "Asha",
          customerPhone: "9999999999",
          ownerName: "Owner",
          businessName: "Boutique",
        },
      ];
    },
    $executeRaw: async (_strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = _strings.join(" ");
      if (!sql.includes('"balance" >=')) {
        throw new Error("balance update is not conditional");
      }
      const amount = Number(values[0]);
      const orderId = Number(values[2]);
      const ownerId = Number(values[3]);
      const order = h.state.orders.find(
        (item) => item.id === orderId && item.ownerId === ownerId
      );
      if (!order || order.balance < amount) return 0;
      order.balance -= amount;
      order.paymentStatus = order.balance === 0 ? "PAID" : "PARTIALLY_PAID";
      h.state.decrements += 1;
      return 1;
    },
    payment: {
      updateMany: async ({
        where,
        data,
      }: {
        where: { id: number; status: string; razorpayPaymentId?: null };
        data: { status: string; razorpayPaymentId: string };
      }) => {
        const payment = h.state.payments.find(
          (item) => item.id === where.id && item.status === where.status
        );
        if (!payment) return { count: 0 };
        if (where.razorpayPaymentId === null && payment.razorpayPaymentId !== null) {
          return { count: 0 };
        }
        payment.status = data.status;
        payment.razorpayPaymentId = data.razorpayPaymentId;
        return { count: 1 };
      },
    },
  };
}

vi.mock("./lib/prisma.js", () => ({
  default: {
    $transaction: async (fn: (tx: ReturnType<typeof makeTx>) => Promise<unknown>) => {
      try {
        return await fn(makeTx());
      } finally {
        h.state.release?.();
        h.state.release = null;
      }
    },
  },
}));

vi.mock("./lib/razorpay.js", () => ({
  default: {
    payments: {
      fetch: (...args: unknown[]) => h.fetchMock(...args),
    },
  },
}));

vi.mock("./modules/email/email.service.js", () => ({
  emailService: {
    enqueuePaymentReceiptTx: (...args: unknown[]) => h.enqueue(...args),
    dispatchForPayment: vi.fn(async () => undefined),
    startWorker: vi.fn(),
    stopWorker: vi.fn(),
  },
}));

function paymentSignature(orderId: string, paymentId: string): string {
  return createHmac("sha256", KEY_SECRET).update(`${orderId}|${paymentId}`).digest("hex");
}

function webhookSignature(body: string): string {
  return createHmac("sha256", WEBHOOK_SECRET).update(body).digest("hex");
}

function capturedBody(eventId = "evt_1") {
  return JSON.stringify({
    event: "payment.captured",
    payload: {
      payment: {
        entity: {
          id: "pay_test_1",
          order_id: "order_test_1",
          status: "captured",
          amount: 40000,
          currency: "INR",
        },
      },
    },
    eventId,
  });
}

describe("payment verification privacy and concurrency", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.RAZORPAY_KEY_SECRET = KEY_SECRET;
    process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
    app = Fastify();
    app.decorate("authenticateOwner", async () => undefined);
    await app.register(rawBody, {
      field: "rawBody",
      global: false,
      encoding: "utf8",
      runFirst: true,
    });
    await app.register(paymentRoutes);
    await app.register(webhookRoutes);
  });

  beforeEach(() => {
    resetState();
  });

  it("returns only the public verification fields", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/payments/verify",
      payload: {
        razorpay_order_id: "order_test_1",
        razorpay_payment_id: "pay_test_1",
        razorpay_signature: paymentSignature("order_test_1", "pay_test_1"),
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Object.keys(body.data).sort()).toEqual([
      "amount",
      "balance",
      "orderId",
      "paymentId",
      "paymentStatus",
      "status",
    ]);
    expect(body.data).toEqual({
      paymentId: 1,
      orderId: 10,
      amount: 400,
      status: "COMPLETED",
      balance: 600,
      paymentStatus: "PARTIALLY_PAID",
    });
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("secret-customer@example.com");
    expect(serialized).not.toContain("9999999999");
    expect(serialized).not.toContain("ownerId");
    expect(body.data.customer).toBeUndefined();
    expect(h.enqueue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ recipient: "secret-customer@example.com" })
    );
    expect(h.state.orders.find((order) => order.id === 11)?.balance).toBe(5000);
    expect(h.state.decrements).toBe(1);
  });

  it("records one balance deduction when verify and webhook arrive together", async () => {
    const webhookPayload = capturedBody("evt_race");
    const [verifyRes, webhookRes] = await Promise.all([
      app.inject({
        method: "POST",
        url: "/payments/verify",
        payload: {
          razorpay_order_id: "order_test_1",
          razorpay_payment_id: "pay_test_1",
          razorpay_signature: paymentSignature("order_test_1", "pay_test_1"),
        },
      }),
      app.inject({
        method: "POST",
        url: "/webhooks/razorpay",
        headers: {
          "content-type": "application/json",
          "x-razorpay-signature": webhookSignature(webhookPayload),
          "x-razorpay-event-id": "evt_race",
        },
        payload: webhookPayload,
      }),
    ]);

    expect(verifyRes.statusCode).toBe(200);
    expect(webhookRes.statusCode).toBe(200);
    expect(h.state.decrements).toBe(1);
    expect(h.state.orders.find((order) => order.id === 10)?.balance).toBe(600);
    expect(h.state.payments[0]?.status).toBe("COMPLETED");
    expect(h.state.orders.find((order) => order.id === 11)?.balance).toBe(5000);
    expect(JSON.stringify(verifyRes.json())).not.toContain("secret-customer@example.com");
  });

  it("accepts a duplicate webhook without deducting again", async () => {
    const webhookPayload = capturedBody("evt_once");
    const headers = {
      "content-type": "application/json",
      "x-razorpay-signature": webhookSignature(webhookPayload),
      "x-razorpay-event-id": "evt_once",
    };

    const first = await app.inject({
      method: "POST",
      url: "/webhooks/razorpay",
      headers,
      payload: webhookPayload,
    });
    const second = await app.inject({
      method: "POST",
      url: "/webhooks/razorpay",
      headers,
      payload: webhookPayload,
    });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(second.json().message).toContain("already processed");
    expect(h.state.decrements).toBe(1);
    expect(h.state.orders.find((order) => order.id === 10)?.balance).toBe(600);
  });

  it("rejects an invalid webhook signature before changing the balance", async () => {
    const webhookPayload = capturedBody("evt_bad");
    const res = await app.inject({
      method: "POST",
      url: "/webhooks/razorpay",
      headers: {
        "content-type": "application/json",
        "x-razorpay-signature": "a".repeat(64),
        "x-razorpay-event-id": "evt_bad",
      },
      payload: webhookPayload,
    });

    expect(res.statusCode).toBe(400);
    expect(h.state.decrements).toBe(0);
    expect(h.state.payments[0]?.status).toBe("PENDING");
    expect(h.state.orders.find((order) => order.id === 10)?.balance).toBe(1000);
  });

  it("does not deduct when the locked balance cannot cover the payment", async () => {
    const order = h.state.orders.find((item) => item.id === 10);
    if (order) order.balance = 100;

    const res = await app.inject({
      method: "POST",
      url: "/payments/verify",
      payload: {
        razorpay_order_id: "order_test_1",
        razorpay_payment_id: "pay_test_1",
        razorpay_signature: paymentSignature("order_test_1", "pay_test_1"),
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().message).toBe("Invalid order balance");
    expect(h.state.decrements).toBe(0);
    expect(h.state.payments[0]?.status).toBe("PENDING");
    expect(h.state.orders.find((item) => item.id === 10)?.balance).toBe(100);
  });

  it("records a captured UPI payment through the same verification path", async () => {
    h.fetchMock.mockResolvedValue({
      id: "pay_upi_1",
      order_id: "order_test_1",
      status: "captured",
      currency: "INR",
      amount: 40000,
      method: "upi",
    });

    const res = await app.inject({
      method: "POST",
      url: "/payments/verify",
      payload: {
        razorpay_order_id: "order_test_1",
        razorpay_payment_id: "pay_upi_1",
        razorpay_signature: paymentSignature("order_test_1", "pay_upi_1"),
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe("COMPLETED");
    expect(h.state.decrements).toBe(1);
    expect(h.state.payments[0]?.status).toBe("COMPLETED");
    expect(h.state.orders.find((order) => order.id === 10)?.balance).toBe(600);
  });

  it("does not mark a pending or failed UPI callback as paid", async () => {
    for (const status of ["created", "authorized", "pending", "failed"]) {
      resetState();
      h.fetchMock.mockResolvedValue({
        id: "pay_upi_open",
        order_id: "order_test_1",
        status,
        currency: "INR",
        amount: 40000,
        method: "upi",
      });

      const res = await app.inject({
        method: "POST",
        url: "/payments/verify",
        payload: {
          razorpay_order_id: "order_test_1",
          razorpay_payment_id: "pay_upi_open",
          razorpay_signature: paymentSignature("order_test_1", "pay_upi_open"),
        },
      });

      expect(res.json().success).toBe(false);
      expect(res.statusCode).toBe(status === "failed" ? 400 : 202);
      expect(h.state.decrements).toBe(0);
      expect(h.state.payments[0]?.status).toBe("PENDING");
      expect(h.state.orders.find((order) => order.id === 10)?.balance).toBe(1000);
    }
  });

  it("keeps an authorized UPI webhook pending and marks a failed UPI webhook without deducting", async () => {
    const authorized = JSON.stringify({
      event: "payment.authorized",
      payload: {
        payment: {
          entity: {
            id: "pay_upi_auth",
            order_id: "order_test_1",
            status: "authorized",
            amount: 40000,
            currency: "INR",
            method: "upi",
          },
        },
      },
    });
    const authorizedRes = await app.inject({
      method: "POST",
      url: "/webhooks/razorpay",
      headers: {
        "content-type": "application/json",
        "x-razorpay-signature": webhookSignature(authorized),
        "x-razorpay-event-id": "evt_upi_authorized",
      },
      payload: authorized,
    });

    expect(authorizedRes.statusCode).toBe(200);
    expect(h.state.decrements).toBe(0);
    expect(h.state.payments[0]?.status).toBe("PENDING");

    const failed = JSON.stringify({
      event: "payment.failed",
      payload: {
        payment: {
          entity: {
            id: "pay_upi_failed",
            order_id: "order_test_1",
            status: "failed",
            amount: 40000,
            currency: "INR",
            method: "upi",
            error_reason: "payment_cancelled",
          },
        },
      },
    });
    const failedRes = await app.inject({
      method: "POST",
      url: "/webhooks/razorpay",
      headers: {
        "content-type": "application/json",
        "x-razorpay-signature": webhookSignature(failed),
        "x-razorpay-event-id": "evt_upi_failed",
      },
      payload: failed,
    });

    expect(failedRes.statusCode).toBe(200);
    expect(h.state.decrements).toBe(0);
    expect(h.state.payments[0]?.status).toBe("FAILED");
    expect(h.state.orders.find((order) => order.id === 10)?.balance).toBe(1000);

    const duplicate = await app.inject({
      method: "POST",
      url: "/webhooks/razorpay",
      headers: {
        "content-type": "application/json",
        "x-razorpay-signature": webhookSignature(failed),
        "x-razorpay-event-id": "evt_upi_failed",
      },
      payload: failed,
    });
    expect(duplicate.statusCode).toBe(200);
    expect(duplicate.json().message).toContain("already processed");
    expect(h.state.decrements).toBe(0);
  });
});
