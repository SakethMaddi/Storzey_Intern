import type { FastifyInstance } from "fastify";
import prisma from "../../lib/prisma.js";
import razorpay from "../../lib/razorpay.js";
import {
  demoPaymentRequestSchema,
  publicTokenParamSchema,
  razorpayOrderRequestSchema,
} from "../../lib/validation.js";

export async function publicRoutes(app: FastifyInstance) {
  // Public Health Check
  app.get("/", async () => {
    return {
      message: "Advance Pay API is running!",
    };
  });

  // GET /api/public/orders/:token - Public order tracking (Rate limit: 60/min per IP)
  app.get(
    "/api/public/orders/:token",
    {
      config: {
        rateLimit: {
          max: 60,
          timeWindow: 60 * 1000, // 1 minute
        },
      },
    },
    async (request, reply) => {
    const paramResult = publicTokenParamSchema.safeParse(request.params);
    if (!paramResult.success) {
      return reply.code(400).send({
        success: false,
        message: "Invalid order tracking token",
      });
    }

    const { token } = paramResult.data;

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
        status: true,
        cancelledAt: true,
        cancellationReason: true,
        promisedDate: true,
        paymentLinkExpiresAt: true,
        createdAt: true,

        customer: {
          select: {
            name: true,
          },
        },

        owner: {
          select: {
            name: true,
            businessName: true,
          },
        },

        stages: {
          orderBy: [{ position: "asc" }, { id: "asc" }],
          select: {
            id: true,
            name: true,
            status: true,
            position: true,
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

    // Authoritative financial calculations:
    // Only COMPLETED or CAPTURED payments count as successful payments
    const successfulPayments = order.payments.filter(
      (p) => p.status === "COMPLETED" || p.status === "CAPTURED"
    );
    const advancePaid = successfulPayments.reduce((sum, p) => sum + p.amount, 0);
    const outstandingBalance = Math.max(0, order.totalAmount - advancePaid);
    const calculatedPaymentStatus =
      advancePaid >= order.totalAmount
        ? "PAID"
        : advancePaid > 0
        ? "PARTIALLY_PAID"
        : "PENDING";

    return reply.send({
      success: true,
      data: {
        ...order,
        advancePaid,
        outstandingBalance,
        balance: outstandingBalance,
        paymentStatus: calculatedPaymentStatus,
        razorpayKeyId: process.env.RAZORPAY_KEY_ID || null,
        isGatewayConfigured: Boolean(razorpay),
      },
    });
  });

  // POST /api/public/orders/:token/razorpay-order - Secure public payment creation by unique publicToken (Rate limit: 5/15min per IP)
  app.post(
    "/api/public/orders/:token/razorpay-order",
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: 15 * 60 * 1000, // 15 minutes
        },
      },
    },
    async (request, reply) => {
      try {
        const paramResult = publicTokenParamSchema.safeParse(request.params);
        if (!paramResult.success) {
          return reply.code(400).send({
            success: false,
            message: "Invalid order tracking token",
          });
        }

        const bodyResult = razorpayOrderRequestSchema.safeParse(request.body);
        if (!bodyResult.success) {
          return reply.code(400).send({
            success: false,
            message:
              bodyResult.error.issues[0]?.message || "Invalid payment type",
          });
        }

        const { token } = paramResult.data;
        const { paymentType } = bodyResult.data;

        if (!razorpay) {
          return reply.code(503).send({
            success: false,
            message: "Razorpay test credentials are not configured yet",
          });
        }

        const order = await prisma.order.findUnique({
          where: { publicToken: token },
        });

        if (!order) {
          return reply.code(404).send({
            success: false,
            message: "Order not found",
          });
        }

        if (order.status === "CANCELLED") {
          return reply.code(400).send({
            success: false,
            message: "Cannot create payment for a cancelled order",
          });
        }

        if (
          order.paymentLinkExpiresAt &&
          new Date(order.paymentLinkExpiresAt).getTime() < Date.now()
        ) {
          return reply.code(400).send({
            success: false,
            message:
              "Payment link has expired. New payment attempts are not accepted for this order.",
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
              orderId: order.id,
              paymentType: "ADVANCE",
              status: "COMPLETED",
            },
            _sum: {
              amount: true,
            },
          });

          const alreadyPaid = paidAdvance._sum.amount ?? 0;
          const remainingAdvance = Math.max(order.advance - alreadyPaid, 0);

          if (remainingAdvance <= 0) {
            return reply.code(400).send({
              success: false,
              message:
                "Advance amount has already been fully paid. Please pay remaining balance.",
            });
          }

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

        const razorpayOrder = await razorpay.orders.create({
          amount: amount * 100,
          currency: "INR",
          receipt: `order-${order.id}-${Date.now()}`,
          notes: {
            orderId: String(order.id),
            publicToken: token,
            paymentType,
          },
        });

        await prisma.payment.create({
          data: {
            orderId: order.id,
            amount,
            paymentType,
            status: "PENDING",
            razorpayOrderId: razorpayOrder.id,
          },
        });

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
        request.log.error(error);
        return reply.code(500).send({
          success: false,
          message: "Unable to create payment order",
        });
      }
    }
  );

  // POST /api/public/orders/:token/demo-payment - Public demo simulation by unique publicToken
  app.post("/api/public/orders/:token/demo-payment", async (request, reply) => {
    try {
      const isProduction = process.env.NODE_ENV === "production";
      if (isProduction || process.env.DEMO_PAYMENTS_ENABLED !== "true") {
        return reply.code(403).send({
          success: false,
          message: "Demo payments are disabled",
        });
      }

      const paramResult = publicTokenParamSchema.safeParse(request.params);
      if (!paramResult.success) {
        return reply.code(400).send({
          success: false,
          message: "Invalid order tracking token",
        });
      }

      const bodyResult = demoPaymentRequestSchema.safeParse(request.body);
      if (!bodyResult.success) {
        return reply.code(400).send({
          success: false,
          message:
            bodyResult.error.issues[0]?.message || "Invalid payment details",
        });
      }

      const { token } = paramResult.data;
      const { paymentType, outcome } = bodyResult.data;

      const result = await prisma.$transaction(async (tx) => {
        const order = await tx.order.findUnique({
          where: { publicToken: token },
        });

        if (!order || order.balance <= 0) {
          throw new Error("ORDER_NOT_PAYABLE");
        }

        if (order.status === "CANCELLED") {
          throw new Error("ORDER_CANCELLED");
        }

        if (
          order.paymentLinkExpiresAt &&
          new Date(order.paymentLinkExpiresAt).getTime() < Date.now()
        ) {
          throw new Error("PAYMENT_LINK_EXPIRED");
        }

        let amount = order.balance;

        if (paymentType === "ADVANCE") {
          const paidAdvance = await tx.payment.aggregate({
            where: {
              orderId: order.id,
              paymentType: "ADVANCE",
              status: "COMPLETED",
            },
            _sum: { amount: true },
          });

          const remainingAdvance = Math.max(
            order.advance - (paidAdvance._sum.amount ?? 0),
            0
          );

          if (remainingAdvance <= 0) {
            throw new Error("ADVANCE_ALREADY_PAID");
          }

          amount = Math.min(remainingAdvance, order.balance);
        }

        if (!Number.isSafeInteger(amount) || amount <= 0) {
          throw new Error("INVALID_PAYMENT_AMOUNT");
        }

        const payment = await tx.payment.create({
          data: {
            orderId: order.id,
            amount,
            paymentType,
            status: outcome === "SUCCESS" ? "COMPLETED" : "FAILED",
          },
        });

        if (outcome === "FAILED") {
          return {
            payment,
            order,
            message: "Demo payment failed (simulated)",
          };
        }

        const updated = await tx.order.updateMany({
          where: {
            id: order.id,
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
          where: { id: order.id },
        });

        await tx.order.update({
          where: { id: order.id },
          data: {
            paymentStatus:
              updatedOrder.balance === 0 ? "PAID" : "PARTIALLY_PAID",
          },
        });

        return {
          payment,
          order: updatedOrder,
          message: "Demo payment completed successfully (simulated)",
        };
      });

      return reply.send({
        success: true,
        message: result.message,
        data: result,
        demo: true,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";

      if (message === "PAYMENT_LINK_EXPIRED") {
        return reply.code(400).send({
          success: false,
          message:
            "Payment link has expired. New payment attempts are not accepted for this order.",
        });
      }

      if (message === "ORDER_CANCELLED") {
        return reply.code(400).send({
          success: false,
          message: "Cannot process payment for a cancelled order",
        });
      }

      if (message === "ORDER_NOT_PAYABLE") {
        return reply.code(400).send({
          success: false,
          message: "Order not found or already paid",
        });
      }

      if (message === "ADVANCE_ALREADY_PAID") {
        return reply.code(400).send({
          success: false,
          message:
            "Advance amount has already been fully paid. Please pay remaining balance.",
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

      request.log.error(error);
      return reply.code(500).send({
        success: false,
        message: "Demo payment processing failed",
      });
    }
  });
}

