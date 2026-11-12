import type { FastifyInstance } from "fastify";
import prisma from "../../lib/prisma.js";
import { createHmac, timingSafeEqual } from "node:crypto";
import { emailService } from "../email/email.service.js";
import {
  completeCapturedPayment,
  markGatewayPaymentFailed,
  SettlementError,
  type PaymentDb,
} from "../payments/payment-settlement.js";

export async function webhookRoutes(app: FastifyInstance) {
  // POST /webhooks/razorpay
  app.post(
    "/webhooks/razorpay",
    {
      config: {
        rawBody: true,
      },
    },
    async (request, reply) => {
      const signatureHeader = request.headers["x-razorpay-signature"];
      const signature = Array.isArray(signatureHeader)
        ? signatureHeader[0]
        : signatureHeader;

      const eventIdHeader = request.headers["x-razorpay-event-id"];
      const eventId = Array.isArray(eventIdHeader)
        ? eventIdHeader[0]
        : eventIdHeader;

      const rawBody = (request as typeof request & { rawBody?: string }).rawBody;
      const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

      if (!signature || !eventId || !rawBody || !webhookSecret) {
        return reply.code(400).send({
          success: false,
          message: "Missing webhook verification details",
        });
      }

      if (!/^[a-fA-F0-9]{64}$/.test(signature)) {
        return reply.code(400).send({
          success: false,
          message: "Invalid webhook signature",
        });
      }

      const expectedSignature = createHmac("sha256", webhookSecret)
        .update(rawBody)
        .digest("hex");

      const expected = Buffer.from(expectedSignature, "hex");
      const received = Buffer.from(signature, "hex");

      if (
        expected.length !== received.length ||
        !timingSafeEqual(expected, received)
      ) {
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

      if (
        ["payment.captured", "payment.failed"].includes(eventType) &&
        !paymentEntity
      ) {
        return reply.code(400).send({
          success: false,
          message: "Missing payment details in webhook",
        });
      }

      let completedPaymentId: number | null = null;

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

          if (eventType === "payment.captured") {
            if (paymentEntity.status !== "captured") {
              throw new Error("PAYMENT_NOT_CAPTURED");
            }
            if (paymentEntity.currency !== "INR") {
              throw new Error("PAYMENT_AMOUNT_MISMATCH");
            }
            const gatewayAmount = Number(paymentEntity.amount);

            try {
              const settled = await completeCapturedPayment(tx as unknown as PaymentDb, {
                razorpayOrderId,
                razorpayPaymentId,
                gatewayAmountPaise: gatewayAmount,
                enforcePaymentLinkExpiry: false,
              });

              if (settled.outcome === "COMPLETED") {
                completedPaymentId = settled.publicView.paymentId;
                if (settled.receipt) {
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
              }
            } catch (settlementError) {
              if (settlementError instanceof SettlementError) {
                if (settlementError.code === "NOT_FOUND") {
                  throw new Error("LOCAL_PAYMENT_NOT_FOUND");
                }
                if (settlementError.code === "AMOUNT_MISMATCH") {
                  throw new Error("PAYMENT_AMOUNT_MISMATCH");
                }
                if (settlementError.code === "INVALID_BALANCE") {
                  throw new Error("INVALID_ORDER_BALANCE");
                }
              }
              throw settlementError;
            }
          }

          if (eventType === "payment.failed") {
            try {
              await markGatewayPaymentFailed(
                tx as unknown as PaymentDb,
                razorpayOrderId,
                razorpayPaymentId
              );
            } catch (settlementError) {
              if (
                settlementError instanceof SettlementError &&
                settlementError.code === "NOT_FOUND"
              ) {
                throw new Error("LOCAL_PAYMENT_NOT_FOUND");
              }
              throw settlementError;
            }
          }
        });

        // Trigger immediate background dispatch after transaction committed successfully
        if (completedPaymentId) {
          emailService.dispatchForPayment(completedPaymentId).catch(() => {});
        }

        return reply.send({
          success: true,
          message: "Webhook processed successfully",
        });
      } catch (error) {
        const errorCode = (error as { code?: string }).code;

        // Duplicate event: already processed successfully
        if (errorCode === "P2002") {
          return reply.send({
            success: true,
            message: "Webhook event already processed",
          });
        }

        request.log.error(error);
        return reply.code(500).send({
          success: false,
          message: "Webhook processing failed",
        });
      }
    }
  );
}

