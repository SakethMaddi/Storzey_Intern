import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  attentionItems,
  buildReceiptHtml,
  isVerifiedPayment,
  remainingBalance,
  totalVerifiedPaid,
  whatsAppShareUrl,
} from "./features/documents/order-documents.ts";

const order = {
  id: 12,
  itemName: "Silk blouse",
  totalAmount: 5000,
  balance: 2000,
  paymentStatus: "PARTIALLY_PAID",
  status: "ACTIVE",
  promisedDate: "2026-11-01",
  createdAt: "2026-10-01T00:00:00.000Z",
  customerName: "Anusha",
  boutiqueName: "Atelier",
};

const payments = [
  { id: 1, amount: 3000, status: "COMPLETED", paymentType: "ADVANCE", createdAt: "2026-10-02T00:00:00.000Z", razorpayPaymentId: "pay_123" },
  { id: 2, amount: 500, status: "FAILED", paymentType: "BALANCE", createdAt: "2026-10-03T00:00:00.000Z" },
];

describe("verified payment documents", () => {
  it("counts only completed or captured payments", () => {
    assert.equal(isVerifiedPayment("FAILED"), false);
    assert.equal(totalVerifiedPaid(payments), 3000);
    assert.equal(remainingBalance(5000, payments), 2000);
  });

  it("refuses a receipt for an unverified payment", () => {
    assert.equal(buildReceiptHtml(order, payments[1], payments), null);
  });

  it("includes the verified amount and reference on a receipt", () => {
    const html = buildReceiptHtml(order, payments[0], payments);
    assert.ok(html);
    assert.match(html, /RCT-1/);
    assert.match(html, /pay_123/);
    assert.match(html, /3,000/);
    assert.match(html, /2,000/);
    assert.doesNotMatch(html, /FAILED/);
  });

  it("builds a manual WhatsApp share link without a destination number", () => {
    const url = whatsAppShareUrl("Order #12");
    assert.equal(url.startsWith("https://wa.me/?text="), true);
    assert.equal(url.includes("phone="), false);
  });

  it("lists pending and delayed orders once, and skips cancelled orders", () => {
    const items = attentionItems(
      [
        order,
        { ...order, id: 13, status: "CANCELLED", balance: 1000, promisedDate: "2020-01-01" },
      ],
      {},
      new Date("2026-11-13T08:00:00+05:30")
    );
    assert.deepEqual(
      items.map((item) => item.id),
      ["pay-12", "late-12"]
    );
  });
});
