import { describe, it } from "node:test";
import assert from "node:assert";

/**
 * Pure helper mirroring the OwnerLoginPage and OwnerSignUpPage error classification logic
 */
export function classifyAuthError(err: any): {
  error: string;
  refId: string;
  fieldErrors?: Record<string, string>;
} {
  // 1. Network / connectivity failure
  if (!err.response || err.code === "ERR_NETWORK" || err.message === "Network Error") {
    return {
      error: "Unable to connect. Please check your internet connection and try again.",
      refId: "",
    };
  }

  const status = err.response?.status;
  const responseData = err.response?.data;

  // 2. Authentication failure: HTTP 401
  if (status === 401) {
    return {
      error: "Incorrect email or password. Please try again.",
      refId: "",
    };
  }

  // 3. Validation errors: HTTP 400
  if (status === 400) {
    const fieldErrors: Record<string, string> = {};
    if (responseData?.errors && typeof responseData.errors === "object") {
      for (const [key, msgs] of Object.entries(responseData.errors as Record<string, any>)) {
        if (Array.isArray(msgs) && msgs.length > 0) {
          fieldErrors[key] = String(msgs[0]);
        } else if (typeof msgs === "string") {
          fieldErrors[key] = msgs;
        }
      }
    }
    const msg = responseData?.message;
    const isSensitive = /prisma|sql|database|table|column|select|stack|at \//i.test(msg || "");
    return {
      error: isSensitive ? "Please check your inputs and try again." : (msg || "Please correct the highlighted fields."),
      refId: "",
      fieldErrors,
    };
  }

  // 4. Unexpected server/database errors: HTTP 500
  const serverRefId = responseData?.refId || "";
  return {
    error: "We couldn't complete your sign-in right now. Please try again in a few moments. If the issue continues, contact support.",
    refId: serverRefId,
  };
}

describe("Frontend Login Error Handling Verification", () => {
  it("formats network errors with exact required user-facing message", () => {
    const networkErr = { code: "ERR_NETWORK", message: "Network Error" };
    const res = classifyAuthError(networkErr);
    assert.strictEqual(
      res.error,
      "Unable to connect. Please check your internet connection and try again."
    );
    assert.strictEqual(res.refId, "");
  });

  it("formats HTTP 401 invalid credentials with exact required user-facing message", () => {
    const authErr = {
      response: {
        status: 401,
        data: {
          success: false,
          message: "Incorrect email or password. Please try again.",
        },
      },
    };
    const res = classifyAuthError(authErr);
    assert.strictEqual(res.error, "Incorrect email or password. Please try again.");
    assert.strictEqual(res.refId, "");
  });

  it("formats HTTP 400 validation errors with field-specific messages and never leaks raw internals", () => {
    const valErr = {
      response: {
        status: 400,
        data: {
          success: false,
          message: "Validation failed",
          errors: {
            email: ["Invalid email address"],
            password: ["Password must be at least 8 characters long"],
          },
        },
      },
    };
    const res = classifyAuthError(valErr);
    assert.strictEqual(res.error, "Validation failed");
    assert.strictEqual(res.fieldErrors?.email, "Invalid email address");
    assert.strictEqual(res.fieldErrors?.password, "Password must be at least 8 characters long");
  });

  it("redacts any sensitive raw backend/SQL/Prisma strings if accidentally returned in 400 message", () => {
    const leakedErr = {
      response: {
        status: 400,
        data: {
          success: false,
          message: "PrismaClientKnownRequestError: Table 'neondb.Owner' does not exist at /src/app.ts",
        },
      },
    };
    const res = classifyAuthError(leakedErr);
    assert.strictEqual(res.error, "Please check your inputs and try again.");
    assert.strictEqual(res.error.includes("Prisma"), false);
    assert.strictEqual(res.error.includes("Table"), false);
  });

  it("formats HTTP 500 server/database errors with exact required message and preserves safe refId", () => {
    const serverErr = {
      response: {
        status: 500,
        data: {
          success: false,
          message: "We couldn't complete your sign-in right now. Please try again in a few moments. If the issue continues, contact support.",
          refId: "ERR-9A8B7C6D",
        },
      },
    };
    const res = classifyAuthError(serverErr);
    assert.strictEqual(
      res.error,
      "We couldn't complete your sign-in right now. Please try again in a few moments. If the issue continues, contact support."
    );
    assert.strictEqual(res.refId, "ERR-9A8B7C6D");
  });

  it("handles HTTP 500 when backend returns raw Prisma column error by displaying safe message", () => {
    const rawPrismaErr = {
      response: {
        status: 500,
        data: {
          message: "The column `Owner.phone` does not exist in the current database. at /backend/src/modules/auth/auth.service.ts",
          refId: "ERR-12345678",
        },
      },
    };
    const res = classifyAuthError(rawPrismaErr);
    assert.strictEqual(
      res.error,
      "We couldn't complete your sign-in right now. Please try again in a few moments. If the issue continues, contact support."
    );
    assert.strictEqual(res.refId, "ERR-12345678");
    assert.strictEqual(res.error.includes("Owner.phone"), false);
    assert.strictEqual(res.error.includes("column"), false);
  });
});

