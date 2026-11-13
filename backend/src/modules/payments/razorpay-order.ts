export interface RazorpayOrderCreatePayload {
  amount: number;
  currency: "INR";
  receipt: string;
  notes: Record<string, string>;
}

/**
 * Amount is already calculated by the caller. The payload intentionally has
 * no `method`, so Razorpay Checkout can offer every method enabled on the
 * account, including UPI, cards and netbanking.
 */
export function buildRazorpayOrderPayload(input: {
  amountRupees: number;
  receipt: string;
  notes: Record<string, string>;
}): RazorpayOrderCreatePayload {
  return {
    amount: input.amountRupees * 100,
    currency: "INR",
    receipt: input.receipt,
    notes: input.notes,
  };
}
