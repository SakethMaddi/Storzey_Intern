/**
 * Formats an amount in INR rupees with the ₹ symbol and Indian grouping.
 * All backend amounts are integers (paisa-free).
 */
export function formatINR(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    return "₹0";
  }
  return `₹${amount.toLocaleString("en-IN")}`;
}

