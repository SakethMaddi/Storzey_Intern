import { describe, it, expect, beforeAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import prisma from "./lib/prisma.js";
import {
  customerSchema,
  orderCreateSchema,
  orderStageCreateSchema,
  stageUpdateSchema,
  manualPaymentSchema,
  demoPaymentRequestSchema,
  numericIdParamSchema,
  validateStrictIndianPhone,
  passwordSchema,
  loginSchema,
  ownerRegisterSchema,
} from "./lib/validation.js";

describe("Strict Indian Phone Validation Unit Tests", () => {
  it("accepts exactly 10 digits starting with 6, 7, 8, 9", () => {
    expect(validateStrictIndianPhone("9876543210").isValid).toBe(true);
    expect(validateStrictIndianPhone("8801778275").isValid).toBe(true);
    expect(validateStrictIndianPhone("7000000000").isValid).toBe(true);
    expect(validateStrictIndianPhone("6123456789").isValid).toBe(true);
  });

  it("rejects 9 digits", () => {
    const res = validateStrictIndianPhone("987654321");
    expect(res.isValid).toBe(false);
    expect(res.message).toContain("exactly 10 digits");
  });

  it("rejects 11 digits without silent truncation", () => {
    const res = validateStrictIndianPhone("98765432101");
    expect(res.isValid).toBe(false);
    expect(res.message).toContain("cannot exceed 10 digits");
  });

  it("rejects numbers starting with 0-5", () => {
    expect(validateStrictIndianPhone("1234567890").isValid).toBe(false);
    expect(validateStrictIndianPhone("0000000000").isValid).toBe(false);
    expect(validateStrictIndianPhone("5555555555").isValid).toBe(false);
  });

  it("rejects numbers with alphabets or special characters", () => {
    expect(validateStrictIndianPhone("98765abc10").isValid).toBe(false);
    expect(validateStrictIndianPhone("98765 43210").isValid).toBe(false);
    expect(validateStrictIndianPhone("98765-43210").isValid).toBe(false);
  });

  it("rejects country code prefix (+91 or 91)", () => {
    const res = validateStrictIndianPhone("+919876543210");
    expect(res.isValid).toBe(false);
    expect(res.message).toContain("Country code");
  });
});

describe("Validation Unit Tests", () => {
  describe("Customer Name Validation", () => {
    it("rejects empty names and whitespace-only names", () => {
      expect(customerSchema.safeParse({ name: "", phone: "9876543210" }).success).toBe(false);
      expect(customerSchema.safeParse({ name: "    ", phone: "9876543210" }).success).toBe(false);
    });

    it("trims whitespace from name", () => {
      const res = customerSchema.safeParse({ name: "  Valid Name  ", phone: "9876543210" });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.name).toBe("Valid Name");
      }
    });
  });

  describe("Order Creation Validation", () => {
    it("rejects missing or empty item name", () => {
      const res = orderCreateSchema.safeParse({
        customerId: 1,
        itemName: "   ",
        totalAmount: 1000,
        advance: 200,
        promisedDate: "2026-11-20",
      });
      expect(res.success).toBe(false);
    });

    it("rejects zero or negative total amount", () => {
      const zero = orderCreateSchema.safeParse({
        customerId: 1,
        itemName: "Shirt",
        totalAmount: 0,
        advance: 0,
        promisedDate: "2026-11-20",
      });
      expect(zero.success).toBe(false);

      const neg = orderCreateSchema.safeParse({
        customerId: 1,
        itemName: "Shirt",
        totalAmount: -500,
        advance: 0,
        promisedDate: "2026-11-20",
      });
      expect(neg.success).toBe(false);
    });

    it("rejects negative advance amount", () => {
      const res = orderCreateSchema.safeParse({
        customerId: 1,
        itemName: "Shirt",
        totalAmount: 1000,
        advance: -50,
        promisedDate: "2026-11-20",
      });
      expect(res.success).toBe(false);
    });

    it("rejects advance exceeding total amount", () => {
      const res = orderCreateSchema.safeParse({
        customerId: 1,
        itemName: "Shirt",
        totalAmount: 1000,
        advance: 1500,
        promisedDate: "2026-11-20",
      });
      expect(res.success).toBe(false);
    });

    it("rejects invalid promised dates", () => {
      const badFormat = orderCreateSchema.safeParse({
        customerId: 1,
        itemName: "Shirt",
        totalAmount: 1000,
        advance: 200,
        promisedDate: "20-11-2026",
      });
      expect(badFormat.success).toBe(false);

      const nonExistentDate = orderCreateSchema.safeParse({
        customerId: 1,
        itemName: "Shirt",
        totalAmount: 1000,
        advance: 200,
        promisedDate: "2026-02-31",
      });
      expect(nonExistentDate.success).toBe(false);
    });

    it("accepts valid order creation parameters", () => {
      const res = orderCreateSchema.safeParse({
        customerId: 1,
        itemName: "Silk Saree",
        totalAmount: 15000,
        advance: 5000,
        promisedDate: "2026-11-30",
      });
      expect(res.success).toBe(true);
    });
  });

  describe("Payment Validation", () => {
    it("rejects zero or negative payments", () => {
      expect(manualPaymentSchema.safeParse({ amount: 0, paymentType: "ADVANCE" }).success).toBe(false);
      expect(manualPaymentSchema.safeParse({ amount: -100, paymentType: "ADVANCE" }).success).toBe(false);
    });

    it("rejects invalid payment type", () => {
      expect(manualPaymentSchema.safeParse({ amount: 500, paymentType: "CREDIT" }).success).toBe(false);
    });

    it("accepts valid payment types", () => {
      expect(manualPaymentSchema.safeParse({ amount: 500, paymentType: "ADVANCE" }).success).toBe(true);
      expect(manualPaymentSchema.safeParse({ amount: 500, paymentType: "BALANCE" }).success).toBe(true);
    });
  });

  describe("Order Stage Validation", () => {
    it("rejects whitespace-only stage names", () => {
      expect(orderStageCreateSchema.safeParse({ name: "   " }).success).toBe(false);
    });

    it("rejects invalid stage status updates", () => {
      expect(stageUpdateSchema.safeParse({ status: "FINISHED" }).success).toBe(false);
      expect(stageUpdateSchema.safeParse({ status: "CANCELLED" }).success).toBe(false);
      expect(stageUpdateSchema.safeParse({ status: "COMPLETED" }).success).toBe(true);
      expect(stageUpdateSchema.safeParse({ status: "IN_PROGRESS" }).success).toBe(true);
      expect(stageUpdateSchema.safeParse({ status: "PENDING" }).success).toBe(true);
    });
  });

  describe("Password UTF-8 Byte Length & Consistency Validation", () => {
    it("accepts valid ASCII password within limits (8 to 72 bytes)", () => {
      const validAscii = "A".repeat(12);
      expect(passwordSchema.safeParse(validAscii).success).toBe(true);

      const loginRes = loginSchema.safeParse({ email: "owner@test.com", password: validAscii });
      expect(loginRes.success).toBe(true);

      const regRes = ownerRegisterSchema.safeParse({
        name: "Owner",
        email: "owner@test.com",
        password: validAscii,
        confirmPassword: validAscii,
      });
      expect(regRes.success).toBe(true);
    });

    it("accepts exactly 72 UTF-8 bytes ASCII password", () => {
      const exactly72Bytes = "P".repeat(72);
      expect(Buffer.byteLength(exactly72Bytes, "utf8")).toBe(72);
      expect(passwordSchema.safeParse(exactly72Bytes).success).toBe(true);

      const loginRes = loginSchema.safeParse({ email: "owner@test.com", password: exactly72Bytes });
      expect(loginRes.success).toBe(true);

      const regRes = ownerRegisterSchema.safeParse({
        name: "Owner",
        email: "owner@test.com",
        password: exactly72Bytes,
        confirmPassword: exactly72Bytes,
      });
      expect(regRes.success).toBe(true);
    });

    it("rejects more than 72 UTF-8 bytes ASCII password", () => {
      const over72Bytes = "P".repeat(73);
      expect(Buffer.byteLength(over72Bytes, "utf8")).toBe(73);

      const passRes = passwordSchema.safeParse(over72Bytes);
      expect(passRes.success).toBe(false);
      if (!passRes.success) {
        expect(passRes.error.issues[0]?.message).toBe("Password cannot exceed 72 UTF-8 bytes");
      }

      const loginRes = loginSchema.safeParse({ email: "owner@test.com", password: over72Bytes });
      expect(loginRes.success).toBe(false);
      if (!loginRes.success) {
        expect(loginRes.error.issues[0]?.message).toBe("Password cannot exceed 72 UTF-8 bytes");
      }

      const regRes = ownerRegisterSchema.safeParse({
        name: "Owner",
        email: "owner@test.com",
        password: over72Bytes,
        confirmPassword: over72Bytes,
      });
      expect(regRes.success).toBe(false);
      if (!regRes.success) {
        expect(regRes.error.issues[0]?.message).toBe("Password cannot exceed 72 UTF-8 bytes");
      }
    });

    it("accepts multibyte Unicode password within the 72-byte limit", () => {
      // '🔐' is 4 bytes in UTF-8. 8 emojis = 32 bytes and 8 characters (surrogate pairs count as 16 code units)
      const validUnicode = "🔐".repeat(8);
      expect(Buffer.byteLength(validUnicode, "utf8")).toBe(32);
      expect(passwordSchema.safeParse(validUnicode).success).toBe(true);

      // Exactly 18 emojis * 4 bytes = 72 bytes
      const exactUnicode72 = "🔐".repeat(18);
      expect(Buffer.byteLength(exactUnicode72, "utf8")).toBe(72);
      expect(passwordSchema.safeParse(exactUnicode72).success).toBe(true);

      const loginRes = loginSchema.safeParse({ email: "owner@test.com", password: exactUnicode72 });
      expect(loginRes.success).toBe(true);

      const regRes = ownerRegisterSchema.safeParse({
        name: "Owner",
        email: "owner@test.com",
        password: exactUnicode72,
        confirmPassword: exactUnicode72,
      });
      expect(regRes.success).toBe(true);
    });

    it("rejects multibyte Unicode password exceeding 72 UTF-8 bytes (even if character length <= 72)", () => {
      // 19 emojis = 19 characters (or 38 code units), but 19 * 4 = 76 bytes in UTF-8
      const overUnicode = "🔐".repeat(19);
      expect(Buffer.byteLength(overUnicode, "utf8")).toBe(76);

      const passRes = passwordSchema.safeParse(overUnicode);
      expect(passRes.success).toBe(false);
      if (!passRes.success) {
        expect(passRes.error.issues[0]?.message).toBe("Password cannot exceed 72 UTF-8 bytes");
      }

      const loginRes = loginSchema.safeParse({ email: "owner@test.com", password: overUnicode });
      expect(loginRes.success).toBe(false);
      if (!loginRes.success) {
        expect(loginRes.error.issues[0]?.message).toBe("Password cannot exceed 72 UTF-8 bytes");
      }

      const regRes = ownerRegisterSchema.safeParse({
        name: "Owner",
        email: "owner@test.com",
        password: overUnicode,
        confirmPassword: overUnicode,
      });
      expect(regRes.success).toBe(false);
      if (!regRes.success) {
        expect(regRes.error.issues[0]?.message).toBe("Password cannot exceed 72 UTF-8 bytes");
      }
    });

    it("rejects empty password", () => {
      const emptyRes = passwordSchema.safeParse("");
      expect(emptyRes.success).toBe(false);
      if (!emptyRes.success) {
        expect(emptyRes.error.issues[0]?.message).toBe("Password must be at least 8 characters long");
      }

      const loginRes = loginSchema.safeParse({ email: "owner@test.com", password: "" });
      expect(loginRes.success).toBe(false);

      const regRes = ownerRegisterSchema.safeParse({
        name: "Owner",
        email: "owner@test.com",
        password: "",
        confirmPassword: "",
      });
      expect(regRes.success).toBe(false);
    });

    it("rejects password shorter than 8 characters", () => {
      const shortPass = "1234567";
      expect(shortPass.length).toBe(7);

      const passRes = passwordSchema.safeParse(shortPass);
      expect(passRes.success).toBe(false);
      if (!passRes.success) {
        expect(passRes.error.issues[0]?.message).toBe("Password must be at least 8 characters long");
      }

      const loginRes = loginSchema.safeParse({ email: "owner@test.com", password: shortPass });
      expect(loginRes.success).toBe(false);
      if (!loginRes.success) {
        expect(loginRes.error.issues[0]?.message).toBe("Password must be at least 8 characters long");
      }

      const regRes = ownerRegisterSchema.safeParse({
        name: "Owner",
        email: "owner@test.com",
        password: shortPass,
        confirmPassword: shortPass,
      });
      expect(regRes.success).toBe(false);
      if (!regRes.success) {
        expect(regRes.error.issues[0]?.message).toBe("Password must be at least 8 characters long");
      }
    });

    it("verifies registration and login schemas use consistent password validation rules", () => {
      const testCases = [
        { pass: "ValidPassword123!", expected: true },
        { pass: "short", expected: false },
        { pass: "A".repeat(72), expected: true },
        { pass: "A".repeat(73), expected: false },
        { pass: "🚀".repeat(18), expected: true },  // 72 bytes
        { pass: "🚀".repeat(19), expected: false }, // 76 bytes
      ];

      for (const tc of testCases) {
        const passParsed = passwordSchema.safeParse(tc.pass).success;
        const loginParsed = loginSchema.safeParse({ email: "test@example.com", password: tc.pass }).success;
        const regParsed = ownerRegisterSchema.safeParse({
          name: "Test",
          email: "test@example.com",
          password: tc.pass,
          confirmPassword: tc.pass,
        }).success;

        expect(passParsed).toBe(tc.expected);
        expect(loginParsed).toBe(tc.expected);
        expect(regParsed).toBe(tc.expected);
      }
    });
  });
});
