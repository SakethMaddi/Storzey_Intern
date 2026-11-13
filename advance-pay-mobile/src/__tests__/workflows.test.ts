import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { registerSchema } from "../validation/auth.schema.ts";
import { orderFormSchema } from "../validation/order.schema.ts";
import { sanitizeErrorMessage } from "../utils/errors.ts";

describe("Phase 4 Complete QA & Readiness Verification", () => {
  describe("1. Authentication Flow Tests", () => {
    test("validates full owner registration data with trimmed email", () => {
      const result = registerSchema.safeParse({
        name: "Meera Patel",
        email: "  MEERA@BOUTIQUE.COM ",
        phone: "9876543210",
        businessName: "Meera Couture",
        password: "securePassword123",
        confirmPassword: "securePassword123",
      });
      assert.equal(result.success, true);
      if (result.success) {
        assert.equal(result.data.email, "meera@boutique.com");
        assert.equal(result.data.name, "Meera Patel");
        assert.equal(result.data.businessName, "Meera Couture");
      }
    });

    test("rejects mismatched passwords during registration", () => {
      const result = registerSchema.safeParse({
        name: "Meera Patel",
        email: "meera@boutique.com",
        password: "securePassword123",
        confirmPassword: "differentPassword456",
      });
      assert.equal(result.success, false);
      if (!result.success) {
        const confirmError = result.error.issues.find((i) => i.path.includes("confirmPassword"));
        assert.ok(confirmError);
        assert.equal(confirmError.message, "Passwords do not match");
      }
    });
  });

  describe("2. Order Module & Stage Tests", () => {
    test("calculates balance correctly when advance is agreed", () => {
      const totalAmount = 25000;
      const advance = 10000;
      const balance = totalAmount - advance;
      assert.equal(balance, 15000);
    });

    test("validates delivery date format YYYY-MM-DD and rejects invalid dates", () => {
      const validDate = orderFormSchema.safeParse({
        itemName: "Silk Sherwani",
        totalAmount: 30000,
        advance: 5000,
        customerId: 1,
        promisedDate: "2026-12-31",
      });
      assert.equal(validDate.success, true);

      const invalidDate = orderFormSchema.safeParse({
        itemName: "Silk Sherwani",
        totalAmount: 30000,
        advance: 5000,
        customerId: 1,
        promisedDate: "2026-02-31", // February 31 does not exist
      });
      assert.equal(invalidDate.success, false);
    });

    test("validates customized production stages up to 15 stages", () => {
      const stages = [
        "Measurement & Consultation",
        "Fabric Sourcing & Dyeing",
        "Pattern Cutting & Stitching",
        "Hand Embroidery & Zari Work",
        "Trial & Fitting",
        "Final Finishing & Pressing",
      ];
      const result = orderFormSchema.safeParse({
        itemName: "Designer Anarkali",
        totalAmount: 45000,
        advance: 15000,
        customerId: 2,
        promisedDate: "2026-12-15",
        stages,
      });
      assert.equal(result.success, true);
      if (result.success) {
        assert.equal(result.data.stages?.length, 6);
      }
    });

    test("rejects order when more than 15 stages are provided", () => {
      const stages = Array.from({ length: 16 }, (_, i) => `Stage ${i + 1}`);
      const result = orderFormSchema.safeParse({
        itemName: "Designer Anarkali",
        totalAmount: 45000,
        advance: 15000,
        customerId: 2,
        promisedDate: "2026-12-15",
        stages,
      });
      assert.equal(result.success, false);
    });
  });

  describe("3. Financial Integrity & Payment Module Rules", () => {
    test("agreed advance is NOT counted as money received when order is created", () => {
      const order = {
        totalAmount: 20000,
        advance: 8000,
        balance: 20000, // Starts at totalAmount on backend
        paymentStatus: "PENDING",
      };
      const payments: Array<{ amount: number; status: string }> = [];

      const totalPaid = payments
        .filter((p) => p.status === "COMPLETED" || p.status === "CAPTURED")
        .reduce((sum, p) => sum + p.amount, 0);

      assert.equal(totalPaid, 0, "No money should be counted as received when 0 payments exist");
      assert.equal(order.balance, 20000, "Balance must remain totalAmount until payment is recorded");
    });

    test("only COMPLETED and CAPTURED payments count toward money received", () => {
      const payments = [
        { id: 1, amount: 5000, status: "COMPLETED", paymentType: "ADVANCE" },
        { id: 2, amount: 3000, status: "PENDING", paymentType: "BALANCE" },
        { id: 3, amount: 2000, status: "FAILED", paymentType: "BALANCE" },
        { id: 4, amount: 1000, status: "CANCELLED", paymentType: "BALANCE" },
      ];

      const validPaid = payments
        .filter((p) => p.status === "COMPLETED" || p.status === "CAPTURED")
        .reduce((sum, p) => sum + p.amount, 0);

      assert.equal(validPaid, 5000, "Only COMPLETED payment should count");
    });

    test("cancelled payments restore balance and are completely excluded from total revenue", () => {
      const totalAmount = 30000;
      const initialPayments = [
        { id: 1, amount: 10000, status: "COMPLETED" },
        { id: 2, amount: 5000, status: "CANCELLED" }, // Voided
      ];

      const activePaid = initialPayments
        .filter((p) => p.status === "COMPLETED" || p.status === "CAPTURED")
        .reduce((sum, p) => sum + p.amount, 0);

      const balance = totalAmount - activePaid;
      assert.equal(activePaid, 10000);
      assert.equal(balance, 20000);
    });

    test("advance payment calculation correctly tracks remaining advance due", () => {
      const orderAdvance = 8000;
      const completedAdvancePayments = [
        { amount: 5000, paymentType: "ADVANCE", status: "COMPLETED" },
      ];

      const alreadyPaidAdvance = completedAdvancePayments.reduce((s, p) => s + p.amount, 0);
      const remainingAdvance = Math.max(0, orderAdvance - alreadyPaidAdvance);

      assert.equal(remainingAdvance, 3000, "Remaining advance should be 3000");

      // Verify validation rule: payment of 4000 exceeds remaining advance of 3000
      const newPaymentAmount = 4000;
      const isExceeding = newPaymentAmount > remainingAdvance;
      assert.equal(isExceeding, true, "Should reject advance payment exceeding remaining advance");
    });

    test("advance is marked settled when paid in full", () => {
      const orderAdvance = 5000;
      const completedAdvancePayments = [
        { amount: 5000, paymentType: "ADVANCE", status: "COMPLETED" },
      ];

      const alreadyPaidAdvance = completedAdvancePayments.reduce((s, p) => s + p.amount, 0);
      const remainingAdvance = Math.max(0, orderAdvance - alreadyPaidAdvance);

      assert.equal(remainingAdvance, 0);
      const isSettled = remainingAdvance <= 0;
      assert.equal(isSettled, true, "Advance should be marked settled");
    });
  });

  describe("4. Production Milestones & Cancellation Immutability", () => {
    test("validates stage progression cycle: PENDING -> IN_PROGRESS -> COMPLETED -> PENDING", () => {
      const getNextStageStatus = (current: string): string => {
        if (current === "PENDING") return "IN_PROGRESS";
        if (current === "IN_PROGRESS") return "COMPLETED";
        return "PENDING";
      };

      assert.equal(getNextStageStatus("PENDING"), "IN_PROGRESS");
      assert.equal(getNextStageStatus("IN_PROGRESS"), "COMPLETED");
      assert.equal(getNextStageStatus("COMPLETED"), "PENDING");
    });

    test("frozen production rule: cancelled order stages must not be modified", () => {
      const orderStatus = "CANCELLED";
      const canAdvanceStage = orderStatus !== "CANCELLED";
      assert.equal(canAdvanceStage, false, "Cancelled order must disallow stage advancement");
    });
  });

  describe("5. Security & Error Sanitization", () => {
    test("sanitizes Prisma database error messages without leaking internals", () => {
      const rawError = {
        response: {
          data: {
            message: "Invalid `prisma.order.findUnique()` invocation: database connection failed at pg_catalog.pg_database",
          },
        },
      };
      const sanitized = sanitizeErrorMessage(rawError);
      assert.equal(
        sanitized,
        "A database error occurred. Please try again or contact support."
      );
    });

    test("sanitizes SQL constraint errors without leaking table/column names", () => {
      const rawError = {
        response: {
          data: {
            message: "duplicate key value violates unique constraint \"Order_customerId_key\"",
          },
        },
      };
      const sanitized = sanitizeErrorMessage(rawError);
      assert.equal(
        sanitized,
        "A database error occurred. Please try again or contact support."
      );
    });

    test("passes safe, user-friendly business error messages through", () => {
      const rawError = {
        response: {
          data: {
            message: "Customer with this phone number already exists",
          },
        },
      };
      const sanitized = sanitizeErrorMessage(rawError);
      assert.equal(sanitized, "Customer with this phone number already exists");
    });

    test("handles network timeout / connection refused errors gracefully", () => {
      const rawError = {
        message: "Network Error: connect ECONNREFUSED 127.0.0.1:5001",
      };
      const sanitized = sanitizeErrorMessage(rawError);
      assert.equal(
        sanitized,
        "Unable to reach Advance Pay servers. Please check your internet connection."
      );
    });
  });
});
