export interface DocumentPayment {
  id: number;
  amount: number;
  status: string;
  paymentType: string;
  createdAt: string;
  razorpayPaymentId?: string | null;
}

export interface DocumentOrder {
  id: number;
  itemName: string;
  totalAmount: number;
  balance: number;
  paymentStatus: string;
  status?: string;
  promisedDate?: string | null;
  createdAt: string;
  isArchived?: boolean;
  customerName: string;
  customerPhone?: string | null;
  boutiqueName: string;
}

const VERIFIED = new Set(["COMPLETED", "CAPTURED"]);

export function isVerifiedPayment(status: string): boolean {
  return VERIFIED.has(status);
}

export function verifiedPayments(payments: DocumentPayment[]): DocumentPayment[] {
  return payments.filter((payment) => isVerifiedPayment(payment.status));
}

export function totalVerifiedPaid(payments: DocumentPayment[]): number {
  return verifiedPayments(payments).reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
}

export function remainingBalance(totalAmount: number, payments: DocumentPayment[]): number {
  return Math.max(0, (Number(totalAmount) || 0) - totalVerifiedPaid(payments));
}

export function istDateKey(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function formatInr(amount: number): string {
  return `₹${(Number(amount) || 0).toLocaleString("en-IN")}`;
}

export function formatDocumentDate(value: string | null | undefined): string {
  const key = istDateKey(value);
  if (!key) return "—";
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function paymentMethod(payment: DocumentPayment): string {
  if (payment.razorpayPaymentId) return "Online (Razorpay)";
  if (payment.paymentType === "ADVANCE") return "Advance";
  if (payment.paymentType === "BALANCE") return "Balance";
  return payment.paymentType;
}

function paymentStatusLabel(status: string): string {
  if (status === "PAID") return "Fully paid";
  if (status === "PARTIALLY_PAID") return "Partially paid";
  if (status === "PENDING") return "Pending";
  return status;
}

function documentShell(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #1e293b; background: #f4f8fb; }
    main { max-width: 720px; margin: 24px auto; background: #fff; border: 1px solid #d7e5ef; border-radius: 12px; padding: 28px; }
    h1 { margin: 0; font-size: 22px; }
    p { margin: 4px 0 0; color: #64748b; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; margin-top: 18px; }
    th, td { text-align: left; padding: 8px 0; border-bottom: 1px solid #e2eaf1; font-size: 14px; vertical-align: top; }
    th { color: #64748b; font-weight: 600; width: 42%; }
    .amount { font-weight: 700; }
    @media print { body { background: #fff; } main { margin: 0; border: 0; } }
  </style>
</head>
<body><main>${body}</main></body>
</html>`;
}

export function buildInvoiceHtml(order: DocumentOrder, payments: DocumentPayment[], issuedOn = new Date()): string | null {
  const paid = payments.length > 0 ? totalVerifiedPaid(payments) : Math.max(0, order.totalAmount - order.balance);
  const due = payments.length > 0 ? remainingBalance(order.totalAmount, payments) : Math.max(0, order.balance);
  const phone = order.customerPhone ? `<tr><th>Customer phone</th><td>${escapeHtml(order.customerPhone)}</td></tr>` : "";
  return documentShell(`Invoice INV-${order.id}`, `
    <p>Advance Pay</p>
    <h1>${escapeHtml(order.boutiqueName || "Advance Pay")}</h1>
    <p>Invoice INV-${order.id}</p>
    <table>
      <tr><th>Invoice date</th><td>${escapeHtml(formatDocumentDate(issuedOn.toISOString()))}</td></tr>
      <tr><th>Customer</th><td>${escapeHtml(order.customerName || "Customer")}</td></tr>
      ${phone}
      <tr><th>Order number</th><td>#${order.id}</td></tr>
      <tr><th>Order date</th><td>${escapeHtml(formatDocumentDate(order.createdAt))}</td></tr>
      <tr><th>Description</th><td>${escapeHtml(order.itemName)}</td></tr>
      <tr><th>Total amount</th><td class="amount">${formatInr(order.totalAmount)}</td></tr>
      <tr><th>Amount paid</th><td class="amount">${formatInr(paid)}</td></tr>
      <tr><th>Remaining balance</th><td class="amount">${formatInr(due)}</td></tr>
      <tr><th>Payment status</th><td>${escapeHtml(paymentStatusLabel(order.paymentStatus))}</td></tr>
    </table>
  `);
}

export function buildReceiptHtml(
  order: DocumentOrder,
  payment: DocumentPayment,
  payments: DocumentPayment[]
): string | null {
  if (!isVerifiedPayment(payment.status)) return null;
  const paid = totalVerifiedPaid(payments);
  const due = remainingBalance(order.totalAmount, payments);
  const reference = payment.razorpayPaymentId || `PAY-${payment.id}`;
  return documentShell(`Receipt RCT-${payment.id}`, `
    <p>Advance Pay</p>
    <h1>${escapeHtml(order.boutiqueName || "Advance Pay")}</h1>
    <p>Receipt RCT-${payment.id}</p>
    <table>
      <tr><th>Order number</th><td>#${order.id}</td></tr>
      <tr><th>Customer</th><td>${escapeHtml(order.customerName || "Customer")}</td></tr>
      <tr><th>Amount received</th><td class="amount">${formatInr(payment.amount)}</td></tr>
      <tr><th>Payment date</th><td>${escapeHtml(formatDocumentDate(payment.createdAt))}</td></tr>
      <tr><th>Payment reference</th><td>${escapeHtml(reference)}</td></tr>
      <tr><th>Payment method</th><td>${escapeHtml(paymentMethod(payment))}</td></tr>
      <tr><th>Total paid so far</th><td class="amount">${formatInr(paid)}</td></tr>
      <tr><th>Remaining balance</th><td class="amount">${formatInr(due)}</td></tr>
    </table>
  `);
}

export function openPrintableDocument(html: string): boolean {
  if (typeof window === "undefined") return false;
  const popup = window.open("", "_blank", "width=820,height=960");
  if (!popup) return false;
  popup.opener = null;
  popup.document.open();
  popup.document.write(html);
  popup.document.close();
  popup.focus();
  window.setTimeout(() => popup.print(), 150);
  return true;
}

export function whatsAppShareUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

export function trackingShareMessage(input: {
  boutiqueName: string;
  orderId: number;
  customerName: string;
  paymentStatus: string;
  balance: number;
  url: string;
}): string {
  return [
    input.boutiqueName || "Advance Pay",
    `Order #${input.orderId} for ${input.customerName || "customer"}`,
    `Payment status: ${paymentStatusLabel(input.paymentStatus)}`,
    `Balance due: ${formatInr(input.balance)}`,
    input.url,
  ].join("\n");
}

export interface AttentionItem {
  id: string;
  orderId: number;
  customerName: string;
  kind: "pending-payment" | "ready-for-delivery" | "delayed-order";
  label: string;
  detail: string;
}

export function attentionItems(
  orders: DocumentOrder[],
  stagesByOrder: Record<number, { name: string; status: string }[]> = {},
  today: Date = new Date()
): AttentionItem[] {
  const todayKey = istDateKey(today);
  const items: AttentionItem[] = [];
  for (const order of orders) {
    if (order.status === "CANCELLED" || order.isArchived) continue;
    if (order.balance > 0) {
      items.push({
        id: `pay-${order.id}`,
        orderId: order.id,
        customerName: order.customerName,
        kind: "pending-payment",
        label: "Pending payment",
        detail: `${formatInr(order.balance)} still due on ${order.itemName}`,
      });
    }
    const promised = istDateKey(order.promisedDate);
    if (promised && todayKey && promised < todayKey) {
      items.push({
        id: `late-${order.id}`,
        orderId: order.id,
        customerName: order.customerName,
        kind: "delayed-order",
        label: "Delayed order",
        detail: `${order.itemName} was promised ${formatDocumentDate(order.promisedDate)}`,
      });
    }
    const ready = (stagesByOrder[order.id] || []).some(
      (stage) => stage.name.trim().toLowerCase() === "ready for delivery" && stage.status === "COMPLETED"
    );
    if (ready) {
      items.push({
        id: `ready-${order.id}`,
        orderId: order.id,
        customerName: order.customerName,
        kind: "ready-for-delivery",
        label: "Ready for delivery",
        detail: `${order.itemName} has reached Ready for Delivery`,
      });
    }
  }
  return items;
}
