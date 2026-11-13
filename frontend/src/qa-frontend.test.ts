import { describe, it } from "node:test";
import assert from "node:assert";
import {
  validateStrictIndianPhone,
  customerSchema,
  orderFormSchema,
  paymentInputSchema,
  passwordSchema,
  ownerLoginSchema,
  ownerRegisterSchema,
  capitalizeFirstLetter,
  isValidHumanName,
  orderCancelSchema,
} from "./validation.ts";

describe("Frontend Phone Validation", () => {
  it("accepts valid 10-digit Indian phone starting with 6-9", () => {
    assert.strictEqual(validateStrictIndianPhone("9876543210").isValid, true);
    assert.strictEqual(validateStrictIndianPhone("8801778275").isValid, true);
    assert.strictEqual(validateStrictIndianPhone("7000000000").isValid, true);
    assert.strictEqual(validateStrictIndianPhone("6123456789").isValid, true);
  });

  it("rejects phone numbers with +91 country prefix", () => {
    const res = validateStrictIndianPhone("+919876543210");
    assert.strictEqual(res.isValid, false);
    assert.ok(res.message?.includes("Country code (+91) is not allowed"));
  });

  it("rejects phone numbers with length other than 10", () => {
    assert.strictEqual(validateStrictIndianPhone("987654321").isValid, false);
    assert.strictEqual(validateStrictIndianPhone("98765432101").isValid, false);
  });

  it("rejects phone numbers starting with 0-5", () => {
    assert.strictEqual(validateStrictIndianPhone("1234567890").isValid, false);
    assert.strictEqual(validateStrictIndianPhone("5555555555").isValid, false);
  });
});

describe("Frontend Customer Schema Validation", () => {
  it("accepts valid customer with name and phone", () => {
    const res = customerSchema.safeParse({
      name: "Priya Sharma",
      phone: "9876543210",
    });
    assert.strictEqual(res.success, true);
  });

  it("accepts customer with Unicode name (Telugu, Hindi, emojis)", () => {
    const res = customerSchema.safeParse({
      name: "ప్రియా శర్మ",
      phone: "9876543210",
    });
    assert.strictEqual(res.success, true);
  });

  it("rejects empty customer name", () => {
    const res = customerSchema.safeParse({
      name: "   ",
      phone: "9876543210",
    });
    assert.strictEqual(res.success, false);
  });

  it("rejects invalid phone in customer schema", () => {
    const res = customerSchema.safeParse({
      name: "Test Customer",
      phone: "1234567890",
    });
    assert.strictEqual(res.success, false);
  });

  it("accepts valid optional email in customer schema", () => {
    const res = customerSchema.safeParse({
      name: "Aanya Patel",
      phone: "9876543210",
      email: "aanya@example.com",
    });
    assert.strictEqual(res.success, true);
    if (res.success) {
      assert.strictEqual(res.data.email, "aanya@example.com");
    }
  });

  it("normalizes empty string email to undefined", () => {
    const res = customerSchema.safeParse({
      name: "Aanya Patel",
      phone: "9876543210",
      email: "   ",
    });
    assert.strictEqual(res.success, true);
    if (res.success) {
      assert.strictEqual(res.data.email, undefined);
    }
  });

  it("rejects malformed email in customer schema", () => {
    const res = customerSchema.safeParse({
      name: "Aanya Patel",
      phone: "9876543210",
      email: "not-an-email",
    });
    assert.strictEqual(res.success, false);
  });
});

describe("Frontend Order Form Schema Validation", () => {
  it("accepts valid order with zero advance", () => {
    const res = orderFormSchema.safeParse({
      customerId: "1",
      itemName: "Kanjeevaram Saree",
      totalAmount: "12000",
      advance: "0",
      promisedDate: "2026-12-15",
    });
    assert.strictEqual(res.success, true);
  });

  it("accepts valid order with partial advance", () => {
    const res = orderFormSchema.safeParse({
      customerId: "2",
      itemName: "Designer Blouse",
      totalAmount: "4000",
      advance: "2000",
      promisedDate: "2026-11-30",
    });
    assert.strictEqual(res.success, true);
  });

  it("accepts valid order with full advance", () => {
    const res = orderFormSchema.safeParse({
      customerId: "2",
      itemName: "Embroidered Dupatta",
      totalAmount: "5000",
      advance: "5000",
      promisedDate: "2026-11-30",
    });
    assert.strictEqual(res.success, true);
  });

  it("rejects advance greater than total amount", () => {
    const res = orderFormSchema.safeParse({
      customerId: "1",
      itemName: "Silk Kurta",
      totalAmount: "5000",
      advance: "6000",
      promisedDate: "2026-11-30",
    });
    assert.strictEqual(res.success, false);
    if (!res.success) {
      assert.ok(res.error.issues.some((i) => i.message.includes("cannot exceed total")));
    }
  });

  it("rejects negative amounts", () => {
    const res = orderFormSchema.safeParse({
      customerId: "1",
      itemName: "Silk Kurta",
      totalAmount: "-5000",
      advance: "0",
      promisedDate: "2026-11-30",
    });
    assert.strictEqual(res.success, false);
  });

  it("rejects non-existent promised date (e.g. Feb 31)", () => {
    const res = orderFormSchema.safeParse({
      customerId: "1",
      itemName: "Silk Kurta",
      totalAmount: "5000",
      advance: "1000",
      promisedDate: "2026-02-31",
    });
    assert.strictEqual(res.success, false);
  });
});

describe("Frontend Payment Input Schema Validation", () => {
  it("accepts positive integer payment amounts", () => {
    assert.strictEqual(paymentInputSchema.safeParse({ amount: "500", type: "ADVANCE" }).success, true);
    assert.strictEqual(paymentInputSchema.safeParse({ amount: "1000", type: "BALANCE" }).success, true);
  });

  it("rejects zero or negative payment amounts", () => {
    assert.strictEqual(paymentInputSchema.safeParse({ amount: "0", type: "BALANCE" }).success, false);
    assert.strictEqual(paymentInputSchema.safeParse({ amount: "-50", type: "BALANCE" }).success, false);
  });
});

describe("Frontend Password & Auth Schemas (UTF-8 Byte Length)", () => {
  it("accepts valid ASCII password (8-72 bytes)", () => {
    assert.strictEqual(passwordSchema.safeParse("ValidPassword123!").success, true);
    assert.strictEqual(passwordSchema.safeParse("P".repeat(72)).success, true);
  });

  it("rejects password exceeding 72 UTF-8 bytes (ASCII)", () => {
    const res = passwordSchema.safeParse("P".repeat(73));
    assert.strictEqual(res.success, false);
    if (!res.success) {
      assert.strictEqual(res.error.issues[0]?.message, "Password cannot exceed 72 UTF-8 bytes");
    }
  });

  it("accepts multibyte Unicode within 72 bytes", () => {
    // 18 emojis * 4 bytes = 72 bytes
    const exact72 = "👑".repeat(18);
    assert.strictEqual(passwordSchema.safeParse(exact72).success, true);
  });

  it("rejects multibyte Unicode exceeding 72 bytes", () => {
    // 19 emojis * 4 bytes = 76 bytes
    const over72 = "👑".repeat(19);
    const res = passwordSchema.safeParse(over72);
    assert.strictEqual(res.success, false);
    if (!res.success) {
      assert.strictEqual(res.error.issues[0]?.message, "Password cannot exceed 72 UTF-8 bytes");
    }
  });

  it("rejects empty password and passwords shorter than 8 characters", () => {
    assert.strictEqual(passwordSchema.safeParse("").success, false);
    assert.strictEqual(passwordSchema.safeParse("short").success, false);
  });

  it("validates owner login schema consistently", () => {
    assert.strictEqual(
      ownerLoginSchema.safeParse({ email: "owner@boutique.com", password: "Password123" }).success,
      true
    );
    assert.strictEqual(
      ownerLoginSchema.safeParse({ email: "not-an-email", password: "Password123" }).success,
      false
    );
  });

  it("validates owner registration schema and password match", () => {
    assert.strictEqual(
      ownerRegisterSchema.safeParse({
        name: "Boutique Owner",
        email: "owner@boutique.com",
        password: "Password123",
        confirmPassword: "Password123",
      }).success,
      true
    );

    // Mismatched passwords
    assert.strictEqual(
      ownerRegisterSchema.safeParse({
        name: "Boutique Owner",
        email: "owner@boutique.com",
        password: "Password123",
        confirmPassword: "DifferentPassword123",
      }).success,
      false
    );
  });
});

describe("Text Field Auto-Capitalization & Name Validation", () => {
  it("capitalizes the first letter of human text while preserving subsequent words", () => {
    assert.strictEqual(capitalizeFirstLetter("anusha"), "Anusha");
    assert.strictEqual(capitalizeFirstLetter("lehanga"), "Lehanga");
    assert.strictEqual(capitalizeFirstLetter("my boutique"), "My boutique");
    assert.strictEqual(capitalizeFirstLetter("12 main road"), "12 main road");
    assert.strictEqual(capitalizeFirstLetter("  anusha"), "  Anusha");
    assert.strictEqual(capitalizeFirstLetter("Anusha"), "Anusha");
    assert.strictEqual(capitalizeFirstLetter(""), "");
  });

  it("preserves multibyte Indic script names", () => {
    assert.strictEqual(capitalizeFirstLetter("ప్రియా శర్మ"), "ప్రియా శర్మ");
    assert.strictEqual(capitalizeFirstLetter("अमित शर्मा"), "अमित शर्मा");
  });

  it("validates human names correctly rejecting digits and symbols", () => {
    assert.strictEqual(isValidHumanName("Anusha Rao"), true);
    assert.strictEqual(isValidHumanName("K. V. Raman"), true);
    assert.strictEqual(isValidHumanName("Mary-Jane"), true);
    assert.strictEqual(isValidHumanName("O'Connor"), true);
    assert.strictEqual(isValidHumanName("ప్రియా శర్మ"), true);
    assert.strictEqual(isValidHumanName("अमित शर्मा"), true);

    // Rejections
    assert.strictEqual(isValidHumanName("Anusha123"), false);
    assert.strictEqual(isValidHumanName("Anusha@#$"), false);
    assert.strictEqual(isValidHumanName("   "), false);
    assert.strictEqual(isValidHumanName("---"), false);
  });
});

describe("Strict Numeric & Monetary Field Validation", () => {
  it("rejects scientific notation (5e3) in order total and advance", () => {
    const res = orderFormSchema.safeParse({
      customerId: "1",
      itemName: "Silk Saree",
      totalAmount: "5e3",
      advance: "0",
      promisedDate: "2026-12-15",
    });
    assert.strictEqual(res.success, false);
  });

  it("rejects decimal numbers in total amount and advance", () => {
    const res = orderFormSchema.safeParse({
      customerId: "1",
      itemName: "Silk Saree",
      totalAmount: "1500.50",
      advance: "0",
      promisedDate: "2026-12-15",
    });
    assert.strictEqual(res.success, false);
  });

  it("rejects currency symbols in total amount and advance", () => {
    const res = orderFormSchema.safeParse({
      customerId: "1",
      itemName: "Silk Saree",
      totalAmount: "₹5000",
      advance: "0",
      promisedDate: "2026-12-15",
    });
    assert.strictEqual(res.success, false);
  });

  it("rejects past delivery dates in order creation", () => {
    const res = orderFormSchema.safeParse({
      customerId: "1",
      itemName: "Silk Saree",
      totalAmount: "5000",
      advance: "1000",
      promisedDate: "2020-01-01",
    });
    assert.strictEqual(res.success, false);
  });
});

describe("Order Cancellation Reason Validation", () => {
  it("accepts valid cancellation reason and capitalizes first letter", () => {
    const res = orderCancelSchema.safeParse({ reason: "customer requested change" });
    assert.strictEqual(res.success, true);
    if (res.success) {
      assert.strictEqual(res.data.reason, "Customer requested change");
    }
  });

  it("rejects empty cancellation reason or reasons shorter than 3 characters", () => {
    assert.strictEqual(orderCancelSchema.safeParse({ reason: "" }).success, false);
    assert.strictEqual(orderCancelSchema.safeParse({ reason: "  " }).success, false);
    assert.strictEqual(orderCancelSchema.safeParse({ reason: "no" }).success, false);
  });
});

