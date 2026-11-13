export const UPI_CHECKOUT_APPS = ["google_pay", "phonepe", "paytm"] as const;

export interface RazorpaySuccessResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface RazorpayCheckoutOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: RazorpaySuccessResponse) => void | Promise<void>;
  modal: { ondismiss: () => void };
  prefill: { name: string };
  theme: { color: string };
  config: {
    display: {
      blocks: {
        upi: {
          name: string;
          instruments: Array<{
            method: "upi";
            flows: Array<"intent" | "qr">;
            apps: Array<(typeof UPI_CHECKOUT_APPS)[number]>;
          }>;
        };
      };
      hide: Array<{ method: string }>;
      sequence: string[];
      preferences: { show_default_blocks: boolean };
    };
  };
}

/**
 * Standard Checkout options. UPI is requested as Intent on mobile and QR on
 * desktop. Collect/VPA entry is omitted. Default blocks stay visible so card,
 * netbanking and wallets enabled on the Razorpay account are not removed.
 * Hiding the default UPI instrument does not hide the UPI block above.
 */
export function buildRazorpayCheckoutOptions(input: {
  keyId: string;
  amount: number;
  currency: string;
  description: string;
  orderId: string;
  customerName: string;
  handler: (response: RazorpaySuccessResponse) => void | Promise<void>;
  onDismiss: () => void;
}): RazorpayCheckoutOptions {
  return {
    key: input.keyId,
    amount: input.amount,
    currency: input.currency,
    name: "Advance Pay Boutique",
    description: input.description,
    order_id: input.orderId,
    handler: input.handler,
    modal: { ondismiss: input.onDismiss },
    prefill: { name: input.customerName },
    theme: { color: "#2563eb" },
    config: {
      display: {
        blocks: {
          upi: {
            name: "Pay by UPI",
            instruments: [
              {
                method: "upi",
                flows: ["intent", "qr"],
                apps: [...UPI_CHECKOUT_APPS],
              },
            ],
          },
        },
        hide: [{ method: "upi" }],
        sequence: ["block.upi"],
        preferences: { show_default_blocks: true },
      },
    },
  };
}
