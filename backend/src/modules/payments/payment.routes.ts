import type { FastifyInstance } from "fastify";
import prisma from "../../lib/prisma.js";
import razorpay from "../../lib/razorpay.js";
import {
  manualPaymentSchema,
  numericIdParamSchema,
  orderPaymentParamSchema,
  paymentCancelSchema,
  razorpayOrderRequestSchema,
  demoPaymentRequestSchema,
  paymentVerifySchema,
} from "../../lib/validation.js";
import { createHmac, timingSafeEqual } from "node:crypto";
import { emailService } from "../email/email.service.js";
import {
  completeCapturedPayment,
  SettlementError,
  toPublicPaymentVerification,
  type PaymentDb,
} from "./payment-settlement.js";

export async function paymentRoutes(app: FastifyInstance) {
  // GET /orders/:id/payments - Protected owner endpoint
  app.get(
    "/orders/:id/payments",
    { preHandler: [(app as any).authenticateOwner] },
    async (request, reply) => {
      try {
        const paramResult = numericIdParamSchema.safeParse(request.params);
        if (!paramResult.success) {
          return reply.code(400).send({
            success: false,
            message: "Invalid order ID",
          });
        }

        const orderId = paramResult.data.id;

        const ownerId = (request as any).user.ownerId;
        const order = await prisma.order.findFirst({
          where: { id: orderId, ownerId },
          select: { id: true },
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
        request.log.error(error);
        return reply.code(500).send({
          success: false,
          message: "Failed to fetch order payments",
        });
      }
    }
  );

  // POST /orders/:id/payments (manual payment) - Protected owner endpoint (Rate limit: 10/10min per IP)
  app.post(
    "/orders/:id/payments",
    {
      preHandler: [(app as any).authenticateOwner],
      config: {
        rateLimit: {
          max: 10,
          timeWindow: 10 * 60 * 1000, // 10 minutes
        },
      },
    },
    async (request, reply) => {
      const paramResult = numericIdParamSchema.safeParse(request.params);
      if (!paramResult.success) {
        return reply.code(400).send({
          success: false,
          message: "Invalid order ID",
        });
      }

      const bodyResult = manualPaymentSchema.safeParse(request.body);
      if (!bodyResult.success) {
        return reply.code(400).send({
          success: false,
          message:
            bodyResult.error.issues[0]?.message || "Invalid payment details",
        });
      }

      const orderId = paramResult.data.id;
      const ownerId = (request as any).user.ownerId;
      const { amount, paymentType } = bodyResult.data;

      try {
        const result = await prisma.$transaction(async (tx) => {
          const order = await tx.order.findFirst({
            where: { id: orderId, ownerId },
          });

          if (!order) {
            throw new Error("ORDER_NOT_FOUND");
          }

          if (order.balance <= 0) {
            throw new Error("ORDER_ALREADY_PAID");
          }

          if (amount > order.balance) {
            throw new Error("PAYMENT_EXCEEDS_BALANCE");
          }

          if (paymentType === "ADVANCE") {
            const paidAdvance = await tx.payment.aggregate({
              where: {
                orderId,
                paymentType: "ADVANCE",
                status: "COMPLETED",
              },
              _sum: { amount: true },
            });

            const alreadyPaidAdvance = paidAdvance._sum.amount ?? 0;
            const remainingAdvance = Math.max(
              order.advance - alreadyPaidAdvance,
              0
            );

            if (remainingAdvance <= 0) {
              throw new Error("ADVANCE_ALREADY_PAID");
            }

            if (amount > remainingAdvance) {
              throw new Error(`ADVANCE_EXCEEDS_REMAINING_${remainingAdvance}`);
            }
          }

          const updateCount = await tx.order.updateMany({
            where: {
              id: orderId,
              balance: { gte: amount },
            },
            data: {
              balance: { decrement: amount },
            },
          });

          if (updateCount.count !== 1) {
            throw new Error("BALANCE_CHANGED");
          }

          const updatedOrder = await tx.order.findUniqueOrThrow({
            where: { id: orderId },
            include: { customer: true, owner: true },
          });

          const payment = await tx.payment.create({
            data: {
              orderId,
              amount,
              paymentType,
              status: "COMPLETED",
            },
          });

          await tx.order.update({
            where: { id: orderId },
            data: {
              paymentStatus:
                updatedOrder.balance === 0 ? "PAID" : "PARTIALLY_PAID",
            },
          });

          if (updatedOrder.customer?.email) {
            await emailService.enqueuePaymentReceiptTx(tx, {
              paymentId: payment.id,
              recipient: updatedOrder.customer.email,
              data: {
                boutiqueName: updatedOrder.owner.businessName || updatedOrder.owner.name,
                customerName: updatedOrder.customer.name,
                orderId: updatedOrder.id,
                itemName: updatedOrder.itemName,
                amountReceived: payment.amount,
                totalAmount: updatedOrder.totalAmount,
                remainingBalance: updatedOrder.balance,
                paymentMethod: "Cash (Store Receipt)",
                paymentDate: new Date().toLocaleString("en-IN", {
                  timeZone: "Asia/Kolkata",
                }),
                referenceId: `CASH-${payment.id}`,
              },
            });
          }

          return { payment, updatedOrder };
        });

        if (result.payment.id) {
          emailService.dispatchForPayment(result.payment.id).catch(() => {});
        }

        return reply.code(201).send({
          success: true,
          message: "Payment recorded successfully",
          data: result,
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : "";
        if (msg === "ORDER_NOT_FOUND") {
          return reply
            .code(404)
            .send({ success: false, message: "Order not found" });
        }
        if (msg === "ORDER_ALREADY_PAID") {
          return reply
            .code(400)
            .send({ success: false, message: "Order is already fully paid" });
        }
        if (msg === "PAYMENT_EXCEEDS_BALANCE") {
          return reply.code(400).send({
            success: false,
            message: "Payment amount cannot exceed remaining balance",
          });
        }
        if (msg === "ADVANCE_ALREADY_PAID") {
          return reply.code(400).send({
            success: false,
            message:
              "Advance payment has already been completed for this order. Please record as BALANCE.",
          });
        }
        if (msg.startsWith("ADVANCE_EXCEEDS_REMAINING_")) {
          const rem = msg.replace("ADVANCE_EXCEEDS_REMAINING_", "");
          return reply.code(400).send({
            success: false,
            message: `Advance payment amount exceeds remaining advance due of ₹${rem}`,
          });
        }
        if (msg === "BALANCE_CHANGED") {
          return reply.code(409).send({
            success: false,
            message:
              "Order balance has changed. Please refresh and try again.",
          });
        }
        request.log.error(error);
        return reply
          .code(500)
          .send({ success: false, message: "Failed to record payment" });
      }
    }
  );

  // POST /orders/:id/razorpay-order - Protected owner endpoint (Rate limit: 10/10min per IP)
  app.post(
    "/orders/:id/razorpay-order",
    {
      preHandler: [(app as any).authenticateOwner],
      config: {
        rateLimit: {
          max: 10,
          timeWindow: 10 * 60 * 1000, // 10 minutes
        },
      },
    },
    async (request, reply) => {
      try {
        const paramResult = numericIdParamSchema.safeParse(request.params);
        if (!paramResult.success) {
          return reply.code(400).send({
            success: false,
            message: "Invalid order ID",
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

        const orderId = paramResult.data.id;
        const ownerId = (request as any).user.ownerId;
        const { paymentType } = bodyResult.data;

        if (!razorpay) {
          return reply.code(503).send({
            success: false,
            message: "Razorpay test credentials are not configured yet",
          });
        }

        const order = await prisma.order.findFirst({
          where: { id: orderId, ownerId },
        });

        if (!order) {
          return reply.code(404).send({
            success: false,
            message: "Order not found",
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
              orderId,
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

  // POST /orders/:id/demo-payment - Protected owner endpoint
  app.post(
    "/orders/:id/demo-payment",
    { preHandler: [(app as any).authenticateOwner] },
    async (request, reply) => {
      try {
        const isProduction = process.env.NODE_ENV === "production";
        if (isProduction || process.env.DEMO_PAYMENTS_ENABLED !== "true") {
          return reply.code(403).send({
            success: false,
            message: "Demo payments are disabled",
          });
        }

        const paramResult = numericIdParamSchema.safeParse(request.params);
        if (!paramResult.success) {
          return reply.code(400).send({
            success: false,
            message: "Invalid order ID",
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

        const orderId = paramResult.data.id;
        const { paymentType, outcome } = bodyResult.data;

        const result = await prisma.$transaction(async (tx) => {
          const order = await tx.order.findUnique({
            where: { id: orderId },
          });

          if (!order || order.balance <= 0) {
            throw new Error("ORDER_NOT_PAYABLE");
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
              orderId,
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
    }
  );

  // POST /payments/verify - Public payment verification
  app.post("/payments/verify", async (request, reply) => {
    const parseResult = paymentVerifySchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.code(400).send({
        success: false,
        message: "Missing payment verification details",
      });
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      parseResult.data;

    const secret = process.env.RAZORPAY_KEY_SECRET;

    if (!secret) {
      return reply.code(500).send({
        success: false,
        message: "Payment configuration error",
      });
    }

    if (!/^[a-fA-F0-9]{64}$/.test(razorpay_signature)) {
      return reply.code(400).send({
        success: false,
        message: "Invalid payment signature",
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

    if (
      gatewayPayment.order_id !== razorpay_order_id ||
      gatewayPayment.status !== "captured" ||
      gatewayPayment.currency !== "INR"
    ) {
      return reply.code(400).send({
        success: false,
        message: "Payment is not successfully captured",
      });
    }

    const gatewayAmount = Number(gatewayPayment.amount);
    if (!Number.isSafeInteger(gatewayAmount) || gatewayAmount <= 0) {
      return reply.code(400).send({
        success: false,
        message: "Invalid payment amount",
      });
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        const settled = await completeCapturedPayment(tx as unknown as PaymentDb, {
          razorpayOrderId: razorpay_order_id,
          razorpayPaymentId: razorpay_payment_id,
          gatewayAmountPaise: gatewayAmount,
          enforcePaymentLinkExpiry: true,
        });

        if (settled.outcome === "COMPLETED" && settled.receipt) {
          await emailService.enqueuePaymentReceiptTx(tx, {
            paymentId: settled.publicView.paymentId,
            recipient: settled.receipt.customerEmail,
            data: {
              boutiqueName: settled.receipt.boutiqueName,
              customerName: settled.receipt.customerName,
              orderId: settled.receipt.orderId,
              itemName: settled.receipt.itemName,
              amountReceived: settled.receipt.amountReceived,
              totalAmount: settled.receipt.totalAmount,
              remainingBalance: settled.receipt.remainingBalance,
              paymentMethod: "Online (Razorpay)",
              paymentDate: new Date().toLocaleString("en-IN", {
                timeZone: "Asia/Kolkata",
              }),
              referenceId: settled.receipt.referenceId,
            },
          });
        }

        return settled;
      });

      if (result.outcome === "NOT_PENDING") {
        return reply.code(409).send({
          success: false,
          message: "Payment already processed",
        });
      }

      if (result.outcome === "COMPLETED") {
        emailService.dispatchForPayment(result.publicView.paymentId).catch(() => {});
      }

      return reply.send(toPublicPaymentVerification(result.publicView));
    } catch (error) {
      const settlementCode = error instanceof SettlementError ? error.code : "";
      const message = error instanceof Error ? error.message : "";

      if (settlementCode === "LINK_EXPIRED" || message === "PAYMENT_LINK_EXPIRED") {
        return reply.code(400).send({
          success: false,
          message:
            "Payment link has expired. New payment attempts are not accepted for this order.",
        });
      }

      if (settlementCode === "NOT_FOUND" || message === "PAYMENT_NOT_FOUND") {
        return reply.code(404).send({
          success: false,
          message: "Pending payment not found",
        });
      }

      if (
        settlementCode === "ALREADY_PROCESSED" ||
        message === "PAYMENT_ALREADY_PROCESSED"
      ) {
        return reply.code(409).send({
          success: false,
          message: "Payment already processed",
        });
      }

      if (settlementCode === "AMOUNT_MISMATCH" || message === "AMOUNT_MISMATCH") {
        return reply.code(400).send({
          success: false,
          message: "Payment amount mismatch",
        });
      }

      if (
        settlementCode === "INVALID_BALANCE" ||
        message === "INVALID_ORDER_BALANCE"
      ) {
        return reply.code(400).send({
          success: false,
          message: "Invalid order balance",
        });
      }

      request.log.error(error);
      return reply.code(500).send({
        success: false,
        message: "Payment verification failed",
      });
    }
  });

  // POST /orders/:id/reconcile - Protected owner endpoint
  app.post(
    "/orders/:id/reconcile",
    { preHandler: [(app as any).authenticateOwner] },
    async (request, reply) => {
      const paramResult = numericIdParamSchema.safeParse(request.params);
      if (!paramResult.success) {
        return reply.code(400).send({
          success: false,
          message: "Invalid order ID",
        });
      }

      const orderId = paramResult.data.id;
      const ownerId = (request as any).user.ownerId;

      const order = await prisma.order.findFirst({
        where: { id: orderId, ownerId },
        include: {
          payments: {
            where: { status: "PENDING" },
          },
        },
      });

      if (!order) {
        return reply.code(404).send({
          success: false,
          message: "Order not found",
        });
      }

      if (!razorpay) {
        return reply.code(503).send({
          success: false,
          message:
            "Razorpay test credentials are not configured yet. Set valid RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to enable reconciliation.",
          data: { pendingPayments: order.payments.length },
        });
      }

      let reconciledCount = 0;

      for (const p of order.payments) {
        if (!p.razorpayOrderId) continue;

        try {
          const paymentsList = await razorpay.orders.fetchPayments(
            p.razorpayOrderId
          );
          const items = (paymentsList as any)?.items || [];
          const captured = items.find((i: any) => i.status === "captured");

          if (captured) {
            await prisma.$transaction(async (tx) => {
              const checkPay = await tx.payment.findUnique({
                where: { id: p.id },
              });
              if (!checkPay || checkPay.status !== "PENDING") return;

              const orderUpdate = await tx.order.updateMany({
                where: { id: orderId, balance: { gte: p.amount } },
                data: { balance: { decrement: p.amount } },
              });

              if (orderUpdate.count !== 1) return;

              await tx.payment.update({
                where: { id: p.id },
                data: {
                  status: "COMPLETED",
                  razorpayPaymentId: captured.id,
                },
              });

              const currentOrder = await tx.order.findUniqueOrThrow({
                where: { id: orderId },
              });
              await tx.order.update({
                where: { id: orderId },
                data: {
                  paymentStatus:
                    currentOrder.balance === 0 ? "PAID" : "PARTIALLY_PAID",
                },
              });

              reconciledCount++;
            });
          }
        } catch (err) {
          request.log.error(err, `Error reconciling payment ${p.id}`);
        }
      }

      const updatedOrder = await prisma.order.findUnique({
        where: { id: orderId },
        include: { payments: true },
      });

      return reply.send({
        success: true,
        message: `Reconciliation completed. ${reconciledCount} payment(s) verified and updated.`,
        data: updatedOrder,
      });
    }
  );

  // PATCH /orders/:orderId/payments/:paymentId/cancel - Protected owner endpoint to cancel a payment
  app.patch(
    "/orders/:orderId/payments/:paymentId/cancel",
    { preHandler: [(app as any).authenticateOwner] },
    async (request, reply) => {
      const paramResult = orderPaymentParamSchema.safeParse(request.params);
      if (!paramResult.success) {
        return reply.code(400).send({
          success: false,
          message: paramResult.error.issues[0]?.message || "Invalid order or payment ID",
        });
      }

      const { orderId, paymentId } = paramResult.data;
      const ownerId = (request as any).user.ownerId;

      paymentCancelSchema.safeParse(request.body);

      try {
        const result = await prisma.$transaction(async (tx) => {
          // Verify order belongs to authenticated owner
          const order = await tx.order.findFirst({
            where: { id: orderId, ownerId },
          });

          if (!order) {
            return { error: 404, message: "Order not found" };
          }

          // Verify payment belongs to this order
          const payment = await tx.payment.findFirst({
            where: { id: paymentId, orderId },
          });

          if (!payment) {
            return { error: 404, message: "Payment record not found for this order" };
          }

          if (payment.status === "CANCELLED") {
            return { error: 400, message: "Payment is already cancelled" };
          }

          // Mark payment as CANCELLED
          const updatedPayment = await tx.payment.update({
            where: { id: paymentId },
            data: { status: "CANCELLED" },
          });

          // Cancel any pending email delivery for this cancelled payment
          await tx.emailOutbox.updateMany({
            where: { paymentId, status: "PENDING" },
            data: { status: "FAILED", lastError: "Payment was cancelled before email delivery" },
          });

          // Recalculate order financial state strictly based on remaining valid successful payments
          const successfulAgg = await tx.payment.aggregate({
            where: {
              orderId,
              status: { in: ["COMPLETED", "CAPTURED"] },
            },
            _sum: { amount: true },
          });

          const totalSuccessfulPaid = successfulAgg._sum.amount ?? 0;
          const newBalance = Math.max(0, order.totalAmount - totalSuccessfulPaid);
          const newPaymentStatus =
            totalSuccessfulPaid >= order.totalAmount
              ? "PAID"
              : totalSuccessfulPaid > 0
              ? "PARTIALLY_PAID"
              : "PENDING";

          const updatedOrder = await tx.order.update({
            where: { id: orderId },
            data: {
              balance: newBalance,
              paymentStatus: newPaymentStatus,
            },
            include: {
              customer: true,
              payments: { orderBy: { createdAt: "desc" } },
            },
          });

          return {
            success: true,
            payment: updatedPayment,
            order: updatedOrder,
            totalSuccessfulPaid,
          };
        });

        if ("error" in result) {
          return reply.code(result.error).send({
            success: false,
            message: result.message,
          });
        }

        return reply.send({
          success: true,
          message: "Payment cancelled successfully.",
          data: {
            payment: result.payment,
            order: result.order,
          },
        });
      } catch (error) {
        request.log.error(error);
        return reply.code(500).send({
          success: false,
          message: "Failed to cancel payment",
        });
      }
    }
  );

  // PATCH /payments/:id/cancel - Protected owner alias endpoint
  app.patch(
    "/payments/:id/cancel",
    { preHandler: [(app as any).authenticateOwner] },
    async (request, reply) => {
      const paramResult = numericIdParamSchema.safeParse(request.params);
      if (!paramResult.success) {
        return reply.code(400).send({
          success: false,
          message: "Invalid payment ID",
        });
      }

      const paymentId = paramResult.data.id;
      const ownerId = (request as any).user.ownerId;

      try {
        const payment = await prisma.payment.findUnique({
          where: { id: paymentId },
          include: { order: true },
        });

        if (!payment || payment.order.ownerId !== ownerId) {
          return reply.code(404).send({
            success: false,
            message: "Payment record not found",
          });
        }

        const orderId = payment.orderId;

        const result = await prisma.$transaction(async (tx) => {
          if (payment.status === "CANCELLED") {
            return { error: 400, message: "Payment is already cancelled" };
          }

          const updatedPayment = await tx.payment.update({
            where: { id: paymentId },
            data: { status: "CANCELLED" },
          });

          await tx.emailOutbox.updateMany({
            where: { paymentId, status: "PENDING" },
            data: { status: "FAILED", lastError: "Payment was cancelled" },
          });

          const successfulAgg = await tx.payment.aggregate({
            where: {
              orderId,
              status: { in: ["COMPLETED", "CAPTURED"] },
            },
            _sum: { amount: true },
          });

          const totalSuccessfulPaid = successfulAgg._sum.amount ?? 0;
          const newBalance = Math.max(0, payment.order.totalAmount - totalSuccessfulPaid);
          const newPaymentStatus =
            totalSuccessfulPaid >= payment.order.totalAmount
              ? "PAID"
              : totalSuccessfulPaid > 0
              ? "PARTIALLY_PAID"
              : "PENDING";

          const updatedOrder = await tx.order.update({
            where: { id: orderId },
            data: {
              balance: newBalance,
              paymentStatus: newPaymentStatus,
            },
            include: {
              customer: true,
              payments: { orderBy: { createdAt: "desc" } },
            },
          });

          return {
            success: true,
            payment: updatedPayment,
            order: updatedOrder,
          };
        });

        if ("error" in result) {
          return reply.code(result.error).send({
            success: false,
            message: result.message,
          });
        }

        return reply.send({
          success: true,
          message: "Payment cancelled successfully.",
          data: {
            payment: result.payment,
            order: result.order,
          },
        });
      } catch (error) {
        request.log.error(error);
        return reply.code(500).send({
          success: false,
          message: "Failed to cancel payment",
        });
      }
    }
  );
}

