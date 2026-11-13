import { capitalizeFirstLetter, orderFormSchema } from "../../validation.ts";

export const ORDER_WIZARD_STEPS = [
  "Customer",
  "Order",
  "Pricing",
  "Advance",
  "Review",
] as const;

export interface OrderWizardInput {
  customerId: string;
  itemName: string;
  totalAmount: string;
  advance: string;
  promisedDate: string;
  stages: string[];
}

function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export function sanitizeOrderStages(stages: string[]): string[] {
  return stages
    .map((stage) => capitalizeFirstLetter(stage.trim()))
    .filter((stage) => stage.length > 0);
}

export function validateOrderStages(stages: string[]): string | null {
  if (stages.length === 0) {
    return "At least one production stage is required";
  }
  const sanitized = sanitizeOrderStages(stages);
  if (sanitized.length !== stages.length) {
    return "Stage names cannot be empty";
  }
  const seen = new Set<string>();
  for (const stage of sanitized) {
    const key = stage.toLowerCase();
    if (seen.has(key)) {
      return `Duplicate stage name "${stage}" is not allowed`;
    }
    seen.add(key);
  }
  return null;
}

const STEP_FIELDS: Record<number, Array<keyof OrderWizardInput>> = {
  0: ["customerId"],
  1: ["itemName"],
  2: ["totalAmount", "promisedDate"],
  3: ["advance"],
  4: ["customerId", "itemName", "totalAmount", "advance", "promisedDate"],
};

export function validateOrderStep(
  step: number,
  input: OrderWizardInput
): Record<string, string> {
  const fields = STEP_FIELDS[step] ?? [];
  const today = utcToday();
  const checkingAdvance = step === 3 || step === 4;
  const payload = {
    customerId: fields.includes("customerId") ? input.customerId : "1",
    itemName: fields.includes("itemName") ? input.itemName : "Garment",
    totalAmount: checkingAdvance
      ? input.totalAmount
      : fields.includes("totalAmount")
        ? input.totalAmount
        : input.totalAmount || "1",
    advance: fields.includes("advance") ? input.advance : "0",
    promisedDate: fields.includes("promisedDate") ? input.promisedDate : today,
  };

  const errors: Record<string, string> = {};
  const result = orderFormSchema.safeParse(payload);
  if (!result.success) {
    for (const issue of result.error.issues) {
      const field = String(issue.path[0] || "");
      if (fields.includes(field as keyof OrderWizardInput) && !errors[field]) {
        errors[field] = issue.message;
      }
    }
  }

  if (step === 1 || step === 4) {
    const stageError = validateOrderStages(input.stages);
    if (stageError) errors.stages = stageError;
  }

  return errors;
}

export function validateCashPayment(
  amount: string,
  balance: number,
  options?: { type?: string; remainingAdvance?: number }
): string | null {
  const raw = amount.trim();
  const amountNum = Number(raw);
  if (
    !raw ||
    Number.isNaN(amountNum) ||
    !Number.isSafeInteger(amountNum) ||
    amountNum <= 0
  ) {
    return "Please enter a valid positive whole payment amount.";
  }
  if (amountNum > balance) {
    return `Payment amount cannot exceed outstanding balance of ₹${balance.toLocaleString("en-IN")}.`;
  }
  if (options?.type === "ADVANCE" && options.remainingAdvance !== undefined) {
    if (options.remainingAdvance <= 0) {
      return "The agreed advance is already recorded. Choose Balance for any further payment.";
    }
    if (amountNum > options.remainingAdvance) {
      return `Advance payment amount exceeds remaining advance due of ₹${options.remainingAdvance.toLocaleString("en-IN")}.`;
    }
  }
  return null;
}

export function remainingAfterPayment(balance: number, amount: string): number | null {
  if (!/^\d+$/.test(amount.trim())) return null;
  return Math.max(0, balance - Number(amount));
}
