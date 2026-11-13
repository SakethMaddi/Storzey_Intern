import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  remainingAfterPayment,
  validateCashPayment,
  validateOrderStep,
  type OrderWizardInput,
} from "./order-wizard.ts";

function input(overrides: Partial<OrderWizardInput> = {}): OrderWizardInput {
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return {
    customerId: "4",
    itemName: "Silk lehenga",
    totalAmount: "5000",
    advance: "2000",
    promisedDate: tomorrow.toISOString().slice(0, 10),
    stages: ["Cutting", "Stitching"],
    ...overrides,
  };
}

describe("create order wizard steps", () => {
  it("requires a customer before the order details step", () => {
    const errors = validateOrderStep(0, input({ customerId: "" }));
    assert.equal(errors.customerId, "Customer selection is mandatory");
    assert.equal(validateOrderStep(0, input()).customerId, undefined);
  });

  it("keeps later answers when an earlier step is checked again", () => {
    const draft = input();
    assert.deepEqual(validateOrderStep(0, draft), {});
    assert.equal(draft.itemName, "Silk lehenga");
    assert.equal(draft.advance, "2000");
  });

  it("rejects a blank garment name and duplicate stages", () => {
    assert.match(validateOrderStep(1, input({ itemName: "   " })).itemName || "", /required/i);
    assert.match(
      validateOrderStep(1, input({ stages: ["Cutting", "cutting"] })).stages || "",
      /Duplicate stage/
    );
  });

  it("rejects an advance larger than the total and accepts zero", () => {
    assert.match(
      validateOrderStep(3, input({ advance: "6000" })).advance || "",
      /cannot exceed/
    );
    assert.equal(validateOrderStep(3, input({ advance: "0" })).advance, undefined);
  });

  it("accepts a complete order on the review step", () => {
    assert.deepEqual(validateOrderStep(4, input()), {});
  });
});

describe("cash payment review", () => {
  it("rejects an empty amount and an amount above the balance", () => {
    assert.match(validateCashPayment("", 1500) || "", /positive whole/);
    assert.match(validateCashPayment("1501", 1500) || "", /cannot exceed/);
  });

  it("calculates the balance that would remain", () => {
    assert.equal(validateCashPayment("500", 1500), null);
    assert.equal(remainingAfterPayment(1500, "500"), 1000);
    assert.equal(remainingAfterPayment(1500, "15.5"), null);
  });

  it("keeps an advance payment inside the agreed advance that is still unpaid", () => {
    assert.match(
      validateCashPayment("1500", 5000, { type: "ADVANCE", remainingAdvance: 1000 }) || "",
      /remaining advance due/
    );
    assert.match(
      validateCashPayment("100", 5000, { type: "ADVANCE", remainingAdvance: 0 }) || "",
      /already recorded/
    );
    assert.equal(
      validateCashPayment("1000", 5000, { type: "BALANCE", remainingAdvance: 0 }),
      null
    );
  });
});
