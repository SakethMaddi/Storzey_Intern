import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateOrderStep, type OrderWizardInput } from "../orders/order-wizard.ts";

describe("Customer-first workflow contract", () => {
  it("strictly enforces customer selection as Step 1 before garment details or advance can be recorded", () => {
    const withoutCustomer: OrderWizardInput = {
      customerId: "",
      itemName: "Silk Sherwani",
      totalAmount: "12000",
      advance: "3000",
      promisedDate: "2026-12-01",
      stages: ["Pattern", "Stitching"],
    };

    const step0Errors = validateOrderStep(0, withoutCustomer);
    assert.equal(step0Errors.customerId, "Customer selection is mandatory");

    // With customer selected, Step 1 passes
    const withCustomer: OrderWizardInput = {
      ...withoutCustomer,
      customerId: "42",
    };
    const step0Pass = validateOrderStep(0, withCustomer);
    assert.deepEqual(step0Pass, {});
  });

  it("validates that a pre-selected customer from customer list satisfies Step 1 immediately", () => {
    const selectedCustomer = { id: 101, name: "Pooja Sharma", phone: "9876543210" };
    const draft: OrderWizardInput = {
      customerId: String(selectedCustomer.id),
      itemName: "",
      totalAmount: "",
      advance: "",
      promisedDate: "",
      stages: ["Cutting", "Stitching"],
    };

    const step0 = validateOrderStep(0, draft);
    assert.deepEqual(step0, {});
  });
});
