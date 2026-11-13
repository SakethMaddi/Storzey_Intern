export type SettlementOutcome = "COMPLETED" | "ALREADY_COMPLETED" | "NOT_PENDING";

export type SettlementCode =
  | "NOT_FOUND"
  | "AMOUNT_MISMATCH"
  | "ALREADY_PROCESSED"
  | "LINK_EXPIRED"
  | "INVALID_BALANCE";

export class SettlementError extends Error {
  constructor(public readonly code: SettlementCode) {
    super(code);
    this.name = "SettlementError";
  }
}

export interface PublicPaymentVerification {
  paymentId: number;
  orderId: number;
  amount: number;
  status: "COMPLETED";
  balance: number;
  paymentStatus: string;
}

export interface PaymentReceiptContext {
  customerEmail: string;
  customerName: string;
  orderId: number;
  itemName: string;
  amountReceived: number;
  totalAmount: number;
  remainingBalance: number;
  boutiqueName: string | null;
  referenceId: string;
}

export interface CapturedPaymentResult {
  outcome: SettlementOutcome;
  publicView: PublicPaymentVerification;
  receipt: PaymentReceiptContext | null;
}

interface LockedGatewayPayment {
  paymentId: number;
  orderId: number;
  amount: number;
  status: string;
  paymentType: string;
  razorpayPaymentId: string | null;
  ownerId: number;
  balance: number;
  paymentStatus: string;
  paymentLinkExpiresAt: Date | null;
  totalAmount: number;
  itemName: string;
  customerEmail: string | null;
  customerName: string | null;
  customerPhone: string | null;
  ownerName: string | null;
  businessName: string | null;
}

export interface PaymentDb {
  $queryRaw<T = unknown>(
    query: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T>;
  $executeRaw(
    query: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<number>;
  payment: {
    updateMany(args: {
      where: {
        id: number;
        status: string;
        razorpayPaymentId?: null;
      };
      data: {
        status: string;
        razorpayPaymentId: string;
      };
    }): Promise<{ count: number }>;
  };
}

function asNumber(value: unknown): number {
  const parsed = typeof value === "bigint" ? Number(value) : Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new SettlementError("INVALID_BALANCE");
  }
  return parsed;
}

function asNullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return String(value);
}

function asDate(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function mapLockedRow(row: Record<string, unknown>): LockedGatewayPayment {
  return {
    paymentId: asNumber(row.paymentId),
    orderId: asNumber(row.orderId),
    amount: asNumber(row.amount),
    status: String(row.status),
    paymentType: String(row.paymentType),
    razorpayPaymentId: asNullableString(row.razorpayPaymentId),
    ownerId: asNumber(row.ownerId),
    balance: asNumber(row.balance),
    paymentStatus: String(row.paymentStatus),
    paymentLinkExpiresAt: asDate(row.paymentLinkExpiresAt),
    totalAmount: asNumber(row.totalAmount),
    itemName: String(row.itemName),
    customerEmail: asNullableString(row.customerEmail),
    customerName: asNullableString(row.customerName),
    customerPhone: asNullableString(row.customerPhone),
    ownerName: asNullableString(row.ownerName),
    businessName: asNullableString(row.businessName),
  };
}

async function lockGatewayPayment(
  tx: PaymentDb,
  razorpayOrderId: string
): Promise<LockedGatewayPayment | null> {
  const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
    SELECT
      p."id" AS "paymentId",
      p."orderId" AS "orderId",
      p."amount" AS "amount",
      p."status" AS "status",
      p."paymentType" AS "paymentType",
      p."razorpayPaymentId" AS "razorpayPaymentId",
      o."ownerId" AS "ownerId",
      o."balance" AS "balance",
      o."paymentStatus" AS "paymentStatus",
      o."paymentLinkExpiresAt" AS "paymentLinkExpiresAt",
      o."totalAmount" AS "totalAmount",
      o."itemName" AS "itemName",
      c."email" AS "customerEmail",
      c."name" AS "customerName",
      c."phone" AS "customerPhone",
      ow."name" AS "ownerName",
      ow."businessName" AS "businessName"
    FROM "Payment" p
    INNER JOIN "Order" o ON o."id" = p."orderId"
    INNER JOIN "Owner" ow ON ow."id" = o."ownerId"
    LEFT JOIN "Customer" c
      ON c."id" = o."customerId" AND c."ownerId" = o."ownerId"
    WHERE p."razorpayOrderId" = ${razorpayOrderId}
    FOR UPDATE OF p, o
  `;

  const row = rows[0];
  if (!row) return null;
  return mapLockedRow(row);
}

function publicViewFrom(
  row: LockedGatewayPayment,
  balance: number,
  paymentStatus: string
): PublicPaymentVerification {
  return {
    paymentId: row.paymentId,
    orderId: row.orderId,
    amount: row.amount,
    status: "COMPLETED",
    balance,
    paymentStatus,
  };
}

function receiptFrom(
  row: LockedGatewayPayment,
  balance: number,
  referenceId: string
): PaymentReceiptContext | null {
  if (!row.customerEmail) return null;
  return {
    customerEmail: row.customerEmail,
    customerName: row.customerName || "Customer",
    orderId: row.orderId,
    itemName: row.itemName,
    amountReceived: row.amount,
    totalAmount: row.totalAmount,
    remainingBalance: balance,
    boutiqueName: row.businessName || row.ownerName,
    referenceId,
  };
}

const PENDING_GATEWAY_STATUSES = new Set([
  "created",
  "authorized",
  "pending",
  "processing",
]);

export type GatewayPaymentClass = "captured" | "failed" | "pending" | "unsupported";

export function classifyGatewayPaymentStatus(status: unknown): GatewayPaymentClass {
  if (status === "captured") return "captured";
  if (status === "failed") return "failed";
  if (typeof status === "string" && PENDING_GATEWAY_STATUSES.has(status)) return "pending";
  return "unsupported";
}

export function toPublicPaymentVerification(view: PublicPaymentVerification) {
  return {
    success: true as const,
    message: "Payment verified and recorded successfully",
    data: {
      paymentId: view.paymentId,
      orderId: view.orderId,
      amount: view.amount,
      status: view.status,
      balance: view.balance,
      paymentStatus: view.paymentStatus,
    },
  };
}

function assertGatewayAmount(row: LockedGatewayPayment, gatewayAmountPaise: number): void {
  if (
    !Number.isSafeInteger(gatewayAmountPaise) ||
    gatewayAmountPaise <= 0 ||
    row.amount * 100 !== gatewayAmountPaise
  ) {
    throw new SettlementError("AMOUNT_MISMATCH");
  }
}

export async function completeCapturedPayment(
  tx: PaymentDb,
  input: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    gatewayAmountPaise: number;
    enforcePaymentLinkExpiry: boolean;
  }
): Promise<CapturedPaymentResult> {
  const row = await lockGatewayPayment(tx, input.razorpayOrderId);
  if (!row || !Number.isSafeInteger(row.ownerId) || row.ownerId <= 0) {
    throw new SettlementError("NOT_FOUND");
  }

  assertGatewayAmount(row, input.gatewayAmountPaise);

  if (row.status === "COMPLETED") {
    if (row.razorpayPaymentId && row.razorpayPaymentId !== input.razorpayPaymentId) {
      throw new SettlementError("ALREADY_PROCESSED");
    }
    return {
      outcome: "ALREADY_COMPLETED",
      publicView: publicViewFrom(row, row.balance, row.paymentStatus),
      receipt: null,
    };
  }

  if (row.status !== "PENDING") {
    return {
      outcome: "NOT_PENDING",
      publicView: publicViewFrom(row, row.balance, row.paymentStatus),
      receipt: null,
    };
  }

  if (
    input.enforcePaymentLinkExpiry &&
    row.paymentLinkExpiresAt &&
    row.paymentLinkExpiresAt.getTime() < Date.now()
  ) {
    throw new SettlementError("LINK_EXPIRED");
  }

  const updated = await tx.$executeRaw`
    UPDATE "Order"
    SET
      "balance" = "balance" - ${row.amount},
      "paymentStatus" = CASE
        WHEN "balance" - ${row.amount} = 0 THEN 'PAID'
        ELSE 'PARTIALLY_PAID'
      END
    WHERE "id" = ${row.orderId}
      AND "ownerId" = ${row.ownerId}
      AND "balance" >= ${row.amount}
  `;

  if (updated !== 1) {
    throw new SettlementError("INVALID_BALANCE");
  }

  const paymentUpdate = await tx.payment.updateMany({
    where: {
      id: row.paymentId,
      status: "PENDING",
      razorpayPaymentId: null,
    },
    data: {
      status: "COMPLETED",
      razorpayPaymentId: input.razorpayPaymentId,
    },
  });

  if (paymentUpdate.count !== 1) {
    throw new SettlementError("ALREADY_PROCESSED");
  }

  const balance = row.balance - row.amount;
  const paymentStatus = balance === 0 ? "PAID" : "PARTIALLY_PAID";

  return {
    outcome: "COMPLETED",
    publicView: publicViewFrom(row, balance, paymentStatus),
    receipt: receiptFrom(row, balance, input.razorpayPaymentId),
  };
}

export async function markGatewayPaymentFailed(
  tx: PaymentDb,
  razorpayOrderId: string,
  razorpayPaymentId: string
): Promise<"FAILED" | "UNCHANGED"> {
  const row = await lockGatewayPayment(tx, razorpayOrderId);
  if (!row) {
    throw new SettlementError("NOT_FOUND");
  }

  if (row.status !== "PENDING") {
    return "UNCHANGED";
  }

  const paymentUpdate = await tx.payment.updateMany({
    where: {
      id: row.paymentId,
      status: "PENDING",
    },
    data: {
      status: "FAILED",
      razorpayPaymentId,
    },
  });

  return paymentUpdate.count === 1 ? "FAILED" : "UNCHANGED";
}
