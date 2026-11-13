import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { loginSchema, passwordSchema } from "../validation/auth.schema.ts";
import { customerSchema, validateStrictIndianPhone } from "../validation/customer.schema.ts";
import { orderFormSchema } from "../validation/order.schema.ts";

describe("Validation Schemas", () => {
  describe("Auth Validation", () => {
    test("loginSchema validates valid email and password", () => {
      const result = loginSchema.safeParse({
        email: "owner@boutique.com",
        password: "password123",
      });
      assert.equal(result.success, true);
      if (result.success) {
        assert.equal(result.data.email, "owner@boutique.com");
      }
    });

    test("loginSchema normalizes email to lowercase and trims", () => {
      const result = loginSchema.safeParse({
        email: "  Owner@Boutique.COM  ",
        password: "password123",
      });
      assert.equal(result.success, true);
      if (result.success) {
        assert.equal(result.data.email, "owner@boutique.com");
      }
    });

    test("loginSchema rejects invalid emails", () => {
      const result = loginSchema.safeParse({
        email: "not-an-email",
        password: "password123",
      });
      assert.equal(result.success, false);
    });

    test("passwordSchema rejects passwords under 8 characters", () => {
      const result = passwordSchema.safeParse("short");
      assert.equal(result.success, false);
    });
  });

  describe("Indian Phone Validation", () => {
    test("accepts valid 10-digit Indian numbers starting with 6, 7, 8, 9", () => {
      assert.equal(validateStrictIndianPhone("9876543210").isValid, true);
      assert.equal(validateStrictIndianPhone("8876543210").isValid, true);
      assert.equal(validateStrictIndianPhone("7876543210").isValid, true);
      assert.equal(validateStrictIndianPhone("6876543210").isValid, true);
    });

    test("rejects numbers starting with 0-5", () => {
      assert.equal(validateStrictIndianPhone("5876543210").isValid, false);
      assert.equal(validateStrictIndianPhone("0876543210").isValid, false);
    });

    test("rejects numbers with non-digit characters or country code", () => {
      assert.equal(validateStrictIndianPhone("+919876543210").isValid, false);
      assert.equal(validateStrictIndianPhone("98765-43210").isValid, false);
    });

    test("rejects numbers with length != 10", () => {
      assert.equal(validateStrictIndianPhone("987654321").isValid, false);
      assert.equal(validateStrictIndianPhone("98765432100").isValid, false);
    });
  });

  describe("Customer Validation", () => {
    test("validates valid customer details and capitalizes name", () => {
      const result = customerSchema.safeParse({
        name: "anusha sharma",
        phone: "9876543210",
        email: "anusha@example.com",
      });
      assert.equal(result.success, true);
      if (result.success) {
        assert.equal(result.data.name, "Anusha sharma");
        assert.equal(result.data.phone, "9876543210");
      }
    });

    test("rejects empty customer name", () => {
      const result = customerSchema.safeParse({
        name: "",
        phone: "9876543210",
      });
      assert.equal(result.success, false);
    });
  });

  describe("Order Validation", () => {
    test("validates valid order with advance <= totalAmount", () => {
      const result = orderFormSchema.safeParse({
        itemName: "silk bridal lehenga",
        totalAmount: 15000,
        advance: 5000,
        customerId: 1,
        promisedDate: "2026-12-01",
      });
      assert.equal(result.success, true);
      if (result.success) {
        assert.equal(result.data.itemName, "Silk bridal lehenga");
        assert.equal(result.data.totalAmount, 15000);
        assert.equal(result.data.advance, 5000);
      }
    });

    test("rejects order when advance > totalAmount", () => {
      const result = orderFormSchema.safeParse({
        itemName: "Silk bridal lehenga",
        totalAmount: 5000,
        advance: 10000,
        customerId: 1,
        promisedDate: "2026-12-01",
      });
      assert.equal(result.success, false);
    });
  });
});
