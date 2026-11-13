import { z } from "zod";

/**
 * Capitalizes ONLY the first alphabetic/letter character in the string,
 * preserving leading spaces and the casing of all subsequent words.
 * Examples:
 *   "anusha" -> "Anusha"
 *   "lehanga" -> "Lehanga"
 *   "my boutique" -> "My boutique"
 *   "12 main road" -> "12 main road"
 */
export function capitalizeFirstLetter(val: string): string {
  if (!val) return val;
  return val.replace(/^(\s*)([\p{L}])/u, (_, space, char) => space + char.toUpperCase());
}

/**
 * Validates a human name:
 * Accepts alphabets (including Indic scripts like Telugu, Hindi), spaces, hyphens,
 * apostrophes, and dots (for initials). Rejects digits, symbols, and empty/space-only strings.
 */
export function isValidHumanName(val: string): boolean {
  if (!val || typeof val !== "string") return false;
  const trimmed = val.trim();
  if (trimmed.length < 1 || trimmed.length > 100) return false;
  if (!/\p{L}/u.test(trimmed)) return false;
  return /^[\p{L}\p{M}\s'.-]+$/u.test(trimmed);
}

/**
 * Strips all non-digit characters from numeric inputs.
 */
export function sanitizeNumericInput(val: string): string {
  return val.replace(/\D/g, "");
}

/**
 * Prevents non-numeric characters from being typed in number inputs.
 */
export function preventInvalidNumberKeys(e: React.KeyboardEvent<HTMLInputElement>): void {
  if (["e", "E", "+", "-", "."].includes(e.key)) {
    e.preventDefault();
  }
}

export const passwordSchema = z
  .string({
    error: "Password is required",
  })
  .min(8, "Password must be at least 8 characters long")
  .refine(
    (val) => {
      // Use globalThis.Buffer if available (Node.js test environments), otherwise standard browser TextEncoder
      const buf = (globalThis as unknown as { Buffer?: { byteLength: (str: string, enc: string) => number } }).Buffer;
      if (buf && typeof buf.byteLength === "function") {
        return buf.byteLength(val, "utf8") <= 72;
      }
      return new TextEncoder().encode(val).length <= 72;
    },
    {
      message: "Password cannot exceed 72 UTF-8 bytes",
    }
  );

export const ownerLoginSchema = z.object({
  email: z
    .string({
      error: "Email is required",
    })
    .max(255, "Email cannot exceed 255 characters")
    .email("Invalid email address")
    .transform((val) => val.trim().toLowerCase()),
  password: passwordSchema,
});

export const ownerRegisterSchema = z
  .object({
    name: z
      .string({
        error: "Owner name is required",
      })
      .transform((val) => capitalizeFirstLetter(val.trim()))
      .refine((val) => val.length > 0, {
        message: "Owner name is required and cannot be empty",
      })
      .refine((val) => val.length <= 100, {
        message: "Owner name cannot exceed 100 characters",
      })
      .refine((val) => isValidHumanName(val), {
        message: "Owner name can only contain letters, spaces, hyphens, apostrophes, and dots",
      }),
    email: z
      .string({
        error: "Email is required",
      })
      .max(255, "Email cannot exceed 255 characters")
      .transform((val) => val.trim().toLowerCase())
      .pipe(z.string().email("Invalid email address")),
    phone: z
      .string()
      .trim()
      .superRefine((val, ctx) => {
        if (val.length > 0) {
          const result = validateStrictIndianPhone(val);
          if (!result.isValid) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: result.message || "Invalid Indian mobile number",
            });
          }
        }
      })
      .optional()
      .nullable()
      .or(z.literal(""))
      .or(z.null())
      .transform((val) => (val && val.length > 0 ? val : null)),
    businessName: z
      .string()
      .trim()
      .max(150, "Business name cannot exceed 150 characters")
      .nullish()
      .or(z.literal(""))
      .transform((val) => {
        if (!val) return null;
        const trimmed = capitalizeFirstLetter(val.trim());
        return trimmed.length > 0 ? trimmed : null;
      }),
    password: passwordSchema,
    confirmPassword: z
      .string({
        error: "Confirm password is required",
      })
      .refine(
        (val) => {
          const buf = (globalThis as unknown as { Buffer?: { byteLength: (str: string, enc: string) => number } }).Buffer;
          if (buf && typeof buf.byteLength === "function") {
            return buf.byteLength(val, "utf8") <= 72;
          }
          return new TextEncoder().encode(val).length <= 72;
        },
        {
          message: "Password cannot exceed 72 UTF-8 bytes",
        }
      ),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export function validateStrictIndianPhone(input: unknown): {
  isValid: boolean;
  message?: string;
  value: string;
} {
  if (typeof input !== "string" && typeof input !== "number") {
    return {
      isValid: false,
      message: "Phone number is required",
      value: "",
    };
  }

  const str = String(input).trim();

  if (str.length === 0) {
    return {
      isValid: false,
      message: "Phone number is required",
      value: "",
    };
  }

  // Reject non-digits
  if (/\D/.test(str)) {
    if (str.startsWith("+91") || (str.startsWith("91") && str.length === 12)) {
      return {
        isValid: false,
        message: "Country code (+91) is not allowed. Enter exactly 10 digits.",
        value: str,
      };
    }
    return {
      isValid: false,
      message: "Only numeric digits (0–9) are allowed.",
      value: str,
    };
  }

  if (str.length < 10) {
    return {
      isValid: false,
      message: `Phone number must be exactly 10 digits (entered ${str.length}).`,
      value: str,
    };
  }

  if (str.length > 10) {
    return {
      isValid: false,
      message: `Phone number cannot exceed 10 digits (entered ${str.length}).`,
      value: str,
    };
  }

  const firstDigit = str.charAt(0);
  if (!["6", "7", "8", "9"].includes(firstDigit)) {
    return {
      isValid: false,
      message: "Indian mobile number must start with 6, 7, 8, or 9.",
      value: str,
    };
  }

  return {
    isValid: true,
    value: str,
  };
}

export const customerSchema = z.object({
  name: z
    .string({
      error: "Customer name is required",
    })
    .transform((val) => capitalizeFirstLetter(val.trim()))
    .refine((val) => val.length > 0, {
      message: "Customer name is required and cannot be empty",
    })
    .refine((val) => val.length <= 100, {
      message: "Customer name cannot exceed 100 characters",
    })
    .refine((val) => isValidHumanName(val), {
      message: "Customer name can only contain letters, spaces, hyphens, apostrophes, and dots",
    }),
  phone: z
    .string({
      error: "Phone number is required",
    })
    .transform((val) => val.trim())
    .superRefine((val, ctx) => {
      const result = validateStrictIndianPhone(val);
      if (!result.isValid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: result.message || "Invalid phone number",
        });
      }
    }),
  email: z
    .string()
    .transform((val) => val.trim())
    .refine((val) => val === "" || z.string().email().safeParse(val).success, {
      message: "Invalid email address",
    })
    .transform((val) => (val === "" ? undefined : val.toLowerCase()))
    .optional(),
});

export const orderFormSchema = z
  .object({
    customerId: z
      .string()
      .min(1, "Customer selection is mandatory")
      .refine((val) => Number.isInteger(Number(val)) && Number(val) > 0, {
        message: "Customer selection is mandatory",
      }),
    itemName: z
      .string()
      .transform((val) => capitalizeFirstLetter(val.trim()))
      .refine((val) => val.length > 0, {
        message: "Item name is required and cannot contain only spaces",
      })
      .refine((val) => val.length <= 100, {
        message: "Item name cannot exceed 100 characters",
      }),
    totalAmount: z
      .string()
      .min(1, "Total amount is required")
      .refine(
        (val) => {
          if (!/^\d+$/.test(val.trim())) return false;
          const num = Number(val);
          return Number.isSafeInteger(num) && num > 0;
        },
        {
          message: "Total amount must be a positive whole number",
        }
      ),
    advance: z
      .string()
      .min(1, "Advance amount is required")
      .refine(
        (val) => {
          if (!/^\d+$/.test(val.trim())) return false;
          const num = Number(val);
          return Number.isSafeInteger(num) && num >= 0;
        },
        {
          message: "Advance amount must be zero or a positive whole number",
        }
      ),
    promisedDate: z
      .string()
      .min(1, "Promised delivery date is required")
      .refine(
        (val) => {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) return false;
          const parsed = Date.parse(`${val}T00:00:00.000Z`);
          if (Number.isNaN(parsed)) return false;
          return (
            new Date(`${val}T00:00:00.000Z`).toISOString().slice(0, 10) === val
          );
        },
        {
          message: "Promised delivery date must be a valid date in YYYY-MM-DD format",
        }
      )
      .refine(
        (val) => {
          const todayStr = new Date().toISOString().slice(0, 10);
          return val >= todayStr;
        },
        {
          message: "Promised delivery date cannot be in the past",
        }
      ),
  })
  .refine(
    (data) => {
      const tot = Number(data.totalAmount);
      const adv = Number(data.advance);
      if (Number.isNaN(tot) || Number.isNaN(adv)) return true;
      return adv <= tot;
    },
    {
      message: "Advance amount cannot exceed total amount",
      path: ["advance"],
    }
  );

export const paymentInputSchema = z.object({
  amount: z
    .string()
    .min(1, "Payment amount is required")
    .refine(
      (val) => {
        if (!/^\d+$/.test(val.trim())) return false;
        const num = Number(val);
        return Number.isSafeInteger(num) && num > 0;
      },
      {
        message: "Payment amount must be a positive whole number",
      }
    ),
  type: z.enum(["ADVANCE", "BALANCE"], {
    error: "Payment type must be ADVANCE or BALANCE",
  }),
});

export const orderStageInputSchema = z
  .string({
    error: "Stage name is required",
  })
  .transform((val) => capitalizeFirstLetter(val.trim()))
  .refine((val) => val.length > 0, {
    message: "Stage name cannot be empty",
  })
  .refine((val) => val.length <= 50, {
    message: "Stage name cannot exceed 50 characters",
  });

export const orderCancelSchema = z.object({
  reason: z
    .string({
      error: "Cancellation reason is required",
    })
    .transform((val) => capitalizeFirstLetter(val.trim()))
    .refine((val) => val.length >= 3, {
      message: "Cancellation reason must be at least 3 characters",
    })
    .refine((val) => val.length <= 500, {
      message: "Cancellation reason cannot exceed 500 characters",
    }),
});
