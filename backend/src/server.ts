import Fastify from "fastify";
import cors from "@fastify/cors";
import prisma from "./lib/prisma.js";
import razorpay from "./lib/razorpay.js";
import { createHmac, timingSafeEqual } from "node:crypto";
import rawBody from "fastify-raw-body";

const app = Fastify({
  logger: true,
});

await app.register(cors, {
  origin: [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
});

await app.register(rawBody, {
  field: "rawBody",
  global: false,
  encoding: "utf8",
  runFirst: true,
});

app.get("/", async () => {
  return {
    message: "Advance Pay API is running!",
  };
});

app.get("/customers", async () => {
  const customers = await prisma.customer.findMany();

  return {
    success: true,
    data: customers,
  };
});

app.post("/customers", async (request, reply) => {
  const { name, phone } = request.body as {
    name: string;
    phone: string;
  };

  const customer = await prisma.customer.create({
    data: {
      name,
      phone,
    },
  });

  return reply.code(201).send({
    success: true,
    data: customer,
  });
});

app.get("/orders", async () => {
  const orders = await prisma.order.findMany({
    include: {
      customer: true,
    },
  });

  return {
    success: true,
    data: orders,
  };
});

app.post("/orders", async (request, reply) => {
  const {
    itemName,
    totalAmount,
    advance,
    customerId,
    promisedDate,
  } = request.body as {
    itemName: string;
    totalAmount: number;
    advance: number;
    customerId: number;
    promisedDate: string;
  };

  if (
    !itemName?.trim() ||
    !Number.isInteger(totalAmount) ||
    !Number.isInteger(advance) ||
    !Number.isInteger(customerId) ||
    totalAmount <= 0 ||
    advance < 0 ||
    advance > totalAmount ||
    !promisedDate ||
    !/^\d{4}-\d{2}-\d{2}$/.test(promisedDate) ||
    Number.isNaN(Date.parse(`${promisedDate}T00:00:00.000Z`)) ||
    new Date(`${promisedDate}T00:00:00.000Z`).toISOString().slice(0, 10) !== promisedDate
  ) {
    return reply.code(400).send({
      success: false,
      message: "Invalid order details, payment amounts, or promised date",
    });
  }

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
  });

  if (!customer) {
    return reply.code(404).send({
      success: false,
      message: "Customer not found",
    });
  }

  const balance = totalAmount;

  const order = await prisma.order.create({
    data: {
      itemName,
      totalAmount,
      advance,
      customerId,
      balance,
      promisedDate: new Date(`${promisedDate}T00:00:00.000Z`),
      paymentStatus: "PENDING",
      stages: {
        create: [
          { name: "Measurements" },
          { name: "Cutting" },
          { name: "Embroidery" },
          { name: "Trial" },
          { name: "Ready" },
        ],
      },
    },
  });

  return reply.code(201).send({
    success: true,
    data: order,
  });
});

app.get("/orders/:id/stages", async (request) => {
  const { id } = request.params as { id: string };

  const stages = await prisma.orderStage.findMany({
    where: {
      orderId: Number(id),
    },
  });

  return {
    success: true,
    data: stages,
  };
});

app.post("/orders/:id/stages", async (request, reply) => {
  const { id } = request.params as { id: string };
  const { name } = request.body as { name: string };
  const orderId = Number(id);
  if (!Number.isInteger(orderId) || orderId <= 0 || !name?.trim()) {
    return reply.code(400).send({
      success: false,
      message: "Invalid order ID or stage name",
    });
  }
  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });
  if (!order) {
    return reply.code(404).send({
      success: false,
      message: "Order not found",
    });
  }
  const stage = await prisma.orderStage.create({
    data: {
      name: name.trim(),
      orderId,
    },
  });
  return reply.code(201).send({
    success: true,
    data: stage,
  });
});

app.get("/orders/:id/payments", async (request, reply) => {
  try {
    const { id } = request.params as { id: string };
    const orderId = Number(id);

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return reply.code(400).send({
        success: false,
        message: "Invalid order ID",
      });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return reply.code(404).send({
        success: false,
        message: "Order not found",
      });
    }

    const payments = await prisma.payment.findMany({
      where: { orderId },
      orderBy: { createdAt: "desc" },
    });

    return reply.send({
      success: true,
      data: payments,
    });
  } catch (error) {
    console.error("Get order payments error:", error);

    return reply.code(500).send({
      success: false,
      message: "Failed to fetch order payments",
    });
  }
});


app.post("/orders/:id/razorpay-order", async (request, reply) => {
  try {
    const { id } = request.params as { id: string };

    const orderId = Number(id);

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return reply.code(400).send({
        success: false,
        message: "Invalid order ID",
      });
    }
    const { paymentType } = request.body as {
      paymentType: "ADVANCE" | "BALANCE";
    };

    if (!["ADVANCE", "BALANCE"].includes(paymentType)) {
      return reply.code(400).send({
        success: false,
        message: "Invalid payment type",
      });
    }

    if (!razorpay) {
      return reply.code(503).send({
        success: false,
        message: "Razorpay test credentials are not configured yet",
      });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      await prisma.payment.updateMany({
        where: {
          orderId,
          status: "PENDING",
        },
        data: {
          status: "FAILED",
        },
      });
      return reply.code(404).send({
        success: false,
        message: "Order not found",
      });
    }

  
    if (order.balance <= 0) {
      return reply.code(400).send({
        success: false,
        message: "Order is already fully paid",
      });
    }
    let amount = order.balance;

    if (paymentType === "ADVANCE") {
      const paidAdvance = await prisma.payment.aggregate({
        where: {
          orderId,
          paymentType: "ADVANCE",
          status: "COMPLETED",
        },
        _sum: {
          amount: true,
        },
      });

      const alreadyPaid = paidAdvance._sum.amount ?? 0;

      const remainingAdvance = Math.max(
        order.advance - alreadyPaid,
        0
      );

      amount = Math.min(remainingAdvance, order.balance);
    }
    if (
      !Number.isSafeInteger(amount) ||
      amount <= 0 ||
      amount > order.balance
    ) {
      return reply.code(400).send({
        success: false,
        message: "Invalid payment amount",
      });
    }

    // 8. Create Razorpay order
    const razorpayOrder = await razorpay.orders.create({
      amount: amount * 100,
      currency: "INR",
      receipt: `order-${orderId}-${Date.now()}`,
      notes: {
        orderId: String(orderId),
        paymentType,
      },
    });
    await prisma.payment.create({
      data: {
        orderId,
        amount,
        paymentType,
        status: "PENDING",
        razorpayOrderId: razorpayOrder.id,
      },
    });

    // 10. Send response
    return reply.send({
      success: true,
      message: "Razorpay order created",
      data: {
        razorpayOrderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
      },
    });
  } catch (error) {
    console.error("Razorpay order creation error:", error);

    return reply.code(500).send({
      success: false,
      message: "Unable to create payment order",
    });
  }
});


app.post("/orders/:id/demo-payment", async (request, reply) => {
  try {
    if (process.env.DEMO_PAYMENTS_ENABLED !== "true") {
      return reply.code(403).send({
        success: false,
        message: "Demo payments are disabled",
      });
    }

    const orderId = Number(
      (request.params as { id: string }).id
    );

    const { paymentType, outcome } = request.body as {
      paymentType: "ADVANCE" | "BALANCE";
      outcome: "SUCCESS" | "FAILED";
    };

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return reply.code(400).send({
        success: false,
        message: "Invalid order ID",
      });
    }

    if (
      !["ADVANCE", "BALANCE"].includes(paymentType) ||
      !["SUCCESS", "FAILED"].includes(outcome)
    ) {
      return reply.code(400).send({
        success: false,
        message: "Invalid payment details",
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
      });

      if (!order || order.balance <= 0) {
        throw new Error("ORDER_NOT_PAYABLE");
      }

      let amount = order.balance;

      if (paymentType === "ADVANCE") {
        const paidAdvance = await tx.payment.aggregate({
          where: {
            orderId,
            paymentType: "ADVANCE",
            status: "COMPLETED",
          },
          _sum: { amount: true },
        });

        const remainingAdvance = Math.max(
          order.advance - (paidAdvance._sum.amount ?? 0),
          0
        );

        amount = Math.min(remainingAdvance, order.balance);
      }

      if (!Number.isSafeInteger(amount) || amount <= 0) {
        throw new Error("INVALID_PAYMENT_AMOUNT");
      }

      const payment = await tx.payment.create({
        data: {
          orderId,
          amount,
          paymentType,
          status: outcome === "SUCCESS" ? "COMPLETED" : "FAILED",
        },
      });

      if (outcome === "FAILED") {
        return { payment, order, message: "Demo payment failed" };
      }

      const updated = await tx.order.updateMany({
        where: {
          id: orderId,
          balance: { gte: amount },
        },
        data: {
          balance: { decrement: amount },
        },
      });

      if (updated.count !== 1) {
        throw new Error("INVALID_ORDER_BALANCE");
      }

      const updatedOrder = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
      });

      await tx.order.update({
        where: { id: orderId },
        data: {
          paymentStatus:
            updatedOrder.balance === 0 ? "PAID" : "PARTIALLY_PAID",
        },
      });

      return {
        payment,
        order: updatedOrder,
        message: "Demo payment completed",
      };
    });

    return reply.send({
      success: true,
      message: result.message,
      data: result,
      demo: true,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "";

    if (message === "ORDER_NOT_PAYABLE") {
      return reply.code(400).send({
        success: false,
        message: "Order not found or already paid",
      });
    }

    if (message === "INVALID_PAYMENT_AMOUNT") {
      return reply.code(400).send({
        success: false,
        message: "Invalid payment amount",
      });
    }

    if (message === "INVALID_ORDER_BALANCE") {
      return reply.code(409).send({
        success: false,
        message: "Order balance changed. Please refresh.",
      });
    }

    console.error("Demo payment error:", error);

    return reply.code(500).send({
      success: false,
      message: "Demo payment failed",
    });
  }
});

app.post("/payments/verify", async (request, reply) => {
  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  } = request.body as {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  };

  if (
    !razorpay_order_id ||
    !razorpay_payment_id ||
    !razorpay_signature
  ) {
    return reply.code(400).send({
      success: false,
      message: "Missing payment verification details",
    });
  }

  const secret = process.env.RAZORPAY_KEY_SECRET;

  if (!secret) {
    return reply.code(500).send({
      success: false,
      message: "Payment configuration error",
    });
  }

  const expectedSignature = createHmac("sha256", secret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  const expected = Buffer.from(expectedSignature, "hex");
  const received = Buffer.from(razorpay_signature, "hex");

  if (
    expected.length !== received.length ||
    !timingSafeEqual(expected, received)
  ) {
    return reply.code(400).send({
      success: false,
      message: "Invalid payment signature",
    });
  }
  if (!razorpay) {
    return reply.code(503).send({
      success: false,
      message: "Razorpay credentials are not configured yet",
    });
  }
  const gatewayPayment = await razorpay.payments.fetch(razorpay_payment_id);
  if (!razorpay) {
    return reply.code(503).send({
      success: false,
      message: "Razorpay credentials are not configured yet",
    });
  }
  if ( gatewayPayment.order_id !== razorpay_order_id ||
      gatewayPayment.status !== "captured" ||
      gatewayPayment.currency !== "INR"
    ) {
      return reply.code(400).send({
        success: false,
        message: "Payment is not successfully captured",
      });
    }

    const gatewayAmount = Number(gatewayPayment.amount);
    if (
        !Number.isSafeInteger(gatewayAmount) ||
        gatewayAmount <= 0
      ) {
        return reply.code(400).send({
          success: false,
          message: "Invalid payment amount",
      });
}

try {
  const result = await prisma.$transaction(async (tx) => {
    const pendingPayment = await tx.payment.findUnique({
      where: { razorpayOrderId: razorpay_order_id },
    });

    if (!pendingPayment) {
      throw new Error("PAYMENT_NOT_FOUND");
    }

    if (pendingPayment.status !== "PENDING") {
      throw new Error("PAYMENT_ALREADY_PROCESSED");
    }

    if (pendingPayment.amount * 100 !== gatewayAmount) {
      throw new Error("AMOUNT_MISMATCH");
    }

    if (pendingPayment.razorpayPaymentId) {
      throw new Error("PAYMENT_ALREADY_PROCESSED");
    }

    const order = await tx.order.findUnique({
      where: { id: pendingPayment.orderId },
    });

    if (!order || pendingPayment.amount > order.balance) {
      throw new Error("INVALID_ORDER_BALANCE");
    }

    const newBalance = order.balance - pendingPayment.amount;

    const paymentUpdate = await tx.payment.updateMany({
    where: {
      id: pendingPayment.id,
      status: "PENDING",
      razorpayPaymentId: null,
    },
    data: {
      status: "COMPLETED",
      razorpayPaymentId: razorpay_payment_id,
    },
  });

  if (paymentUpdate.count !== 1) {
    throw new Error("PAYMENT_ALREADY_PROCESSED");
  }
  const updatedPayment = await tx.payment.findUniqueOrThrow({
  where: {
    id: pendingPayment.id,
  },
});

    const updatedOrder = await tx.order.update({
      where: { id: order.id },
      data: {
        balance: newBalance,
        paymentStatus: newBalance === 0 ? "PAID" : "PARTIALLY_PAID",
      },
    });

    return { updatedPayment, updatedOrder };
  });

  return reply.send({
    success: true,
    message: "Payment verified and recorded successfully",
    data: result,
  });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "";

      if (message === "PAYMENT_NOT_FOUND") {
        return reply.code(404).send({
          success: false,
          message: "Pending payment not found",
        });
      }

      if (message === "PAYMENT_ALREADY_PROCESSED") {
        return reply.code(409).send({
          success: false,
          message: "Payment already processed",
        });
      }

      if (message === "AMOUNT_MISMATCH") {
        return reply.code(400).send({
          success: false,
          message: "Payment amount mismatch",
        });
      }

      if (message === "INVALID_ORDER_BALANCE") {
        return reply.code(400).send({
          success: false,
          message: "Invalid order balance",
        });
      }

      throw error;
    }
});

app.patch("/stages/:id", async (request, reply) => {
  const { id } = request.params as { id: string };
  const { status } = request.body as { status: string };
  const stageId = Number(id);
  const allowedStatuses = ["PENDING", "IN_PROGRESS", "COMPLETED"];
  if (
    !Number.isInteger(stageId) ||
    stageId <= 0 ||
    !allowedStatuses.includes(status)
  ) {
    return reply.code(400).send({
      success: false,
      message: "Invalid stage ID or status",
    });
  }
  const existingStage = await prisma.orderStage.findUnique({
    where: { id: stageId },
  });
  if (!existingStage) {
    return reply.code(404).send({
      success: false,
      message: "Stage not found",
    });
  }
  const stage = await prisma.orderStage.update({
    where: { id: stageId },
    data: { status },
  });
  return {
    success: true,
    data: stage,
  };
});

app.get("/orders/:id", async (request, reply) => {
  const { id } = request.params as { id: string };
  const order = await prisma.order.findUnique({
    where: {
      id: Number(id),
    },
    include: {
      customer: true,
      payments: true,
      stages: true,
    },
  });
  if (!order) {
    return reply.code(404).send({
      success: false,
      message: "Order not found",
    });
  }
  return {
    success: true,
    data: order,
  };
});

app.get("/api/public/orders/:token", async (request, reply) => {
  const { token } = request.params as {
    token: string;
  };

  const order = await prisma.order.findUnique({
    where: {
      publicToken: token,
    },
    select: {
      id: true,
      itemName: true,
      totalAmount: true,
      advance: true,
      balance: true,
      paymentStatus: true,
      promisedDate: true,
      createdAt: true,

      customer: {
        select: {
          name: true,
        },
      },

      stages: {
        orderBy: {
          id: "asc",
        },
        select: {
          id: true,
          name: true,
          status: true,
        },
      },

      payments: {
        orderBy: {
          createdAt: "asc",
        },
        select: {
          id: true,
          amount: true,
          paymentType: true,
          status: true,
          createdAt: true,
        },
      },
    },
  });

  if (!order) {
    return reply.code(404).send({
      success: false,
      message: "Order not found",
    });
  }

  return reply.send({
    success: true,
    data: order,
  });
});


app.post( "/webhooks/razorpay",
  {
    config: {
      rawBody: true,
    },
  },
  async (request, reply) => {
    const signatureHeader =
      request.headers["x-razorpay-signature"];

    const signature = Array.isArray(signatureHeader)
      ? signatureHeader[0]
      : signatureHeader;

    const eventIdHeader =
      request.headers["x-razorpay-event-id"];

    const eventId = Array.isArray(eventIdHeader)
      ? eventIdHeader[0]
      : eventIdHeader;

    const rawBody = (
      request as typeof request & { rawBody?: string }
    ).rawBody;

    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!signature || !eventId || !rawBody || !webhookSecret) {
    
      return reply.code(400).send({
        success: false,
        message: "Missing webhook verification details",
      });
    }
    const expectedSignature = createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    if (!/^[a-fA-F0-9]{64}$/.test(signature)) {
      return reply.code(400).send({
        success: false,
        message: "Invalid webhook signature",
      });
    }

    const expected = Buffer.from(expectedSignature, "hex");
    const received = Buffer.from(signature, "hex");

    if (!timingSafeEqual(expected, received)) {
      return reply.code(400).send({
        success: false,
        message: "Invalid webhook signature",
      });
    }

    let event: any;

    try {
      event = JSON.parse(rawBody);
    } catch {
      return reply.code(400).send({
        success: false,
        message: "Invalid webhook payload",
      });
    }

    const eventType = event.event;
    const paymentEntity = event.payload?.payment?.entity;

    if ( ["payment.captured", "payment.failed"].includes(eventType) && !paymentEntity) {
      return reply.code(400).send({
        success: false,
        message: "Missing payment details in webhook",
      });
    }

    try {
      await prisma.$transaction(async (tx) => {
        await tx.webhookEvent.create({
          data: {
            eventId,
            eventType,
            payload: event,
          },
        });

        if (
          eventType !== "payment.captured" &&
          eventType !== "payment.failed"
        ) {
          return;
        }

        const razorpayOrderId = paymentEntity.order_id;
        const razorpayPaymentId = paymentEntity.id;

        if (!razorpayOrderId || !razorpayPaymentId) {
          throw new Error("MISSING_GATEWAY_PAYMENT_DETAILS");
        }

        const payment = await tx.payment.findUnique({
          where: { razorpayOrderId },
        });

        if (!payment) {
          throw new Error("LOCAL_PAYMENT_NOT_FOUND");
        }
        if (eventType === "payment.captured") {
          if (paymentEntity.status !== "captured") { throw new Error("PAYMENT_NOT_CAPTURED"); }
          const gatewayAmount = Number(paymentEntity.amount);

          if (
            paymentEntity.currency !== "INR" ||
            gatewayAmount !== payment.amount * 100
          ) {
            throw new Error("PAYMENT_AMOUNT_MISMATCH");
          }
          if (payment.status === "COMPLETED") {
            if (payment.razorpayPaymentId !== razorpayPaymentId) {
              throw new Error("PAYMENT_ALREADY_COMPLETED");
            }

            return;
          }

          if (payment.status !== "PENDING") {
            throw new Error("PAYMENT_NOT_PENDING");
          }

          // Atomically prevent the order balance from becoming negative.
          const orderUpdate = await tx.order.updateMany({
            where: {
              id: payment.orderId,
              balance: {
                gte: payment.amount,
              },
            },
            data: {
              balance: {
                decrement: payment.amount,
              },
            },
          });

          if (orderUpdate.count !== 1) {
            throw new Error("INVALID_ORDER_BALANCE");
          }

          const updatedOrder = await tx.order.findUniqueOrThrow({
            where: { id: payment.orderId },
          });

          const paymentUpdate = await tx.payment.updateMany({
            where: {
              id: payment.id,
              status: "PENDING",
              razorpayPaymentId: null,
            },
            data: {
              status: "COMPLETED",
              razorpayPaymentId,
            },
          });

          if (paymentUpdate.count !== 1) {
            throw new Error("PAYMENT_ALREADY_PROCESSED");
          }

          await tx.order.update({
            where: { id: payment.orderId },
            data: {
              paymentStatus:
                updatedOrder.balance === 0
                  ? "PAID"
                  : "PARTIALLY_PAID",
            },
          });
        }
        if (eventType === "payment.failed") {
          if (payment.status === "PENDING") {
            await tx.payment.updateMany({
              where: {
                id: payment.id,
                status: "PENDING",
              },
              data: {
                status: "FAILED",
              },
            });
          }
        }
      });

      return reply.send({
        success: true,
        message: "Webhook processed successfully",
      });
    } catch (error) {
      const errorCode = (error as { code?: string }).code;

      // Duplicate event: already processed successfully.
      if (errorCode === "P2002") {
        return reply.send({
          success: true,
          message: "Duplicate webhook ignored",
        });
      }

      console.error("Razorpay webhook processing error:", error);

      return reply.code(500).send({
        success: false,
        message: "Webhook processing failed",
      });
    }
  }
);


const start = async () => {
  try {
    await app.listen({
      port: Number(process.env.PORT) || 5000,
      host: "0.0.0.0",
    });
    console.log("Server running at http://localhost:5000");
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};
start();