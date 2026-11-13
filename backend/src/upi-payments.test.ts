import { describe, expect, it } from "vitest";
import { classifyGatewayPaymentStatus } from "./modules/payments/payment-settlement.js";
import { buildRazorpayOrderPayload } from "./modules/payments/razorpay-order.js";

describe("UPI payment classification", () => {
  it("treats only captured payments as paid and leaves UPI in-progress states pending", () => {
    expect(classifyGatewayPaymentStatus("captured")).toBe("captured");
    expect(classifyGatewayPaymentStatus("failed")).toBe("failed");
    for (const status of ["created", "authorized", "pending", "processing"]) {
      expect(classifyGatewayPaymentStatus(status)).toBe("pending");
    }
    expect(classifyGatewayPaymentStatus("refunded")).toBe("unsupported");
    expect(classifyGatewayPaymentStatus(undefined)).toBe("unsupported");
  });

  it("creates an INR order without restricting the payment method", () => {
    const payload = buildRazorpayOrderPayload({
      amountRupees: 250,
      receipt: "order-10-1",
      notes: { orderId: "10", paymentType: "ADVANCE" },
    });

    expect(payload).toEqual({
      amount: 25000,
      currency: "INR",
      receipt: "order-10-1",
      notes: { orderId: "10", paymentType: "ADVANCE" },
    });
    expect(payload).not.toHaveProperty("method");
  });
});
