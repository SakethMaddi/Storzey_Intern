import { z } from "zod";

/**
 * Strict Indian phone number validation:
 * Exactly 10 digits — no more and no less.
 * Must start with 6, 7, 8, or 9.
 * Only digits (0-9).
 * Rejects numbers containing letters, spaces, special characters, leading 0-5,
 * or country codes like +91.
 */
export const strictIndianPhoneRegex = /^[6-9]\d{9}$/;

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

  // Reject if contains any non-digit character (including +, spaces, dashes, letters)
  if (/\D/.test(str)) {
    if (str.startsWith("+91") || str.startsWith("91") && str.length === 12) {
      return {
        isValid: false,
        message: "Country code is not allowed. Enter exactly 10 digits.",
        value: str,
      };
    }
    return {
      isValid: false,
      message: "Phone number must contain only numeric digits (0–9).",
      value: str,
    };
  }

  if (str.length < 10) {
    return {
      isValid: false,
      message: `Phone number must be exactly 10 digits (currently ${str.length}).`,
      value: str,
    };
  }

  if (str.length > 10) {
    return {
      isValid: false,
      message: `Phone number cannot exceed 10 digits (currently ${str.length}).`,
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
    .transform((val) => val.trim())
    .refine((val) => val.length > 0, {
      message: "Customer name is required and cannot be empty",
    })
    .refine((val) => val.length <= 100, {
      message: "Customer name cannot exceed 100 characters",
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
    .trim()
    .max(255, "Email cannot exceed 255 characters")
    .email("Invalid email address")
    .optional()
    .nullable()
    .or(z.literal(""))
    .transform((val) => (val && val.length > 0 ? val.toLowerCase() : null)),
});

export const customerUpdateSchema = z.object({
  name: z
    .string({
      error: "Customer name is required",
    })
    .transform((val) => val.trim())
    .refine((val) => val.length > 0, {
      message: "Customer name is required and cannot be empty",
    })
    .refine((val) => val.length <= 100, {
      message: "Customer name cannot exceed 100 characters",
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
          message: result.message || "Invalid Indian mobile number",
        });
      }
    }),
  email: z
    .string()
    .trim()
    .max(255, "Email cannot exceed 255 characters")
    .email("Invalid email address")
    .optional()
    .nullable()
    .or(z.literal(""))
    .transform((val) => (val && val.length > 0 ? val.toLowerCase() : null)),
});

export const orderStageInputSchema = z
  .string({
    error: "Stage name is required",
  })
  .transform((val) => val.trim())
  .refine((val) => val.length > 0, {
    message: "Stage name cannot be empty",
  })
  .refine((val) => val.length <= 50, {
    message: "Stage name cannot exceed 50 characters",
  });

export const orderCreateSchema = z
  .object({
    itemName: z
      .string({
        error: "Item name is required",
      })
      .transform((val) => val.trim())
      .refine((val) => val.length > 0, {
        message: "Item name is required and cannot be empty",
      })
      .refine((val) => val.length <= 100, {
        message: "Item name cannot exceed 100 characters",
      }),
    totalAmount: z
      .number({
        error: "Total amount must be a number",
      })
      .refine(Number.isSafeInteger, {
        message: "Total amount must be a safe integer",
      })
      .refine((val) => val > 0, {
        message: "Total amount must be greater than zero",
      }),
    advance: z
      .number({
        error: "Advance amount must be a number",
      })
      .refine(Number.isSafeInteger, {
        message: "Advance amount must be a safe integer",
      })
      .refine((val) => val >= 0, {
        message: "Advance amount cannot be negative",
      }),
    customerId: z
      .number({
        error: "Customer selection is mandatory",
      })
      .int()
      .positive("Valid customer ID is required"),
    promisedDate: z
      .string({
        error: "Promised delivery date is required",
      })
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
      ),
    stages: z
      .array(orderStageInputSchema)
      .max(15, "Cannot have more than 15 stages")
      .optional()
      .refine(
        (stagesList) => {
          if (!stagesList || stagesList.length === 0) return true;
          const seen = new Set<string>();
          for (const s of stagesList) {
            const normalized = s.trim().toLowerCase();
            if (seen.has(normalized)) return false;
            seen.add(normalized);
          }
          return true;
        },
        {
          message: "Duplicate stage names are not allowed in the same order",
        }
      ),
  })
  .refine((data) => data.advance <= data.totalAmount, {
    message: "Advance amount cannot exceed total amount",
    path: ["advance"],
  });

export const orderStageCreateSchema = z.object({
  name: z
    .string({
      error: "Stage name is required",
    })
    .transform((val) => val.trim())
    .refine((val) => val.length > 0, {
      message: "Stage name is required and cannot be empty",
    })
    .refine((val) => val.length <= 50, {
      message: "Stage name cannot exceed 50 characters",
    }),
});

export const allowedStageStatuses = [
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
] as const;

export const stageUpdateSchema = z.object({
  status: z.enum(allowedStageStatuses, {
    error: "Invalid stage status. Allowed: PENDING, IN_PROGRESS, COMPLETED",
  }),
});

export const manualPaymentSchema = z.object({
  amount: z
    .number({
      error: "Payment amount must be a number",
    })
    .refine(Number.isSafeInteger, {
      message: "Payment amount must be a safe integer",
    })
    .refine((val) => val > 0, {
      message: "Payment amount must be greater than zero",
    }),
  paymentType: z.enum(["ADVANCE", "BALANCE"], {
    error: "Invalid payment type. Must be ADVANCE or BALANCE",
  }),
});

export const razorpayOrderRequestSchema = z.object({
  paymentType: z.enum(["ADVANCE", "BALANCE"], {
    error: "Invalid payment type. Must be ADVANCE or BALANCE",
  }),
});

export const demoPaymentRequestSchema = z.object({
  paymentType: z.enum(["ADVANCE", "BALANCE"], {
    error: "Invalid payment type. Must be ADVANCE or BALANCE",
  }),
  outcome: z.enum(["SUCCESS", "FAILED"], {
    error: "Outcome must be SUCCESS or FAILED",
  }),
});

export const paymentVerifySchema = z.object({
  razorpay_order_id: z.string().min(1, "Razorpay order ID is required").max(100, "Razorpay order ID is too long"),
  razorpay_payment_id: z.string().min(1, "Razorpay payment ID is required").max(100, "Razorpay payment ID is too long"),
  razorpay_signature: z.string().min(1, "Razorpay signature is required").max(256, "Razorpay signature is too long"),
});

export const numericIdParamSchema = z.object({
  id: z
    .string()
    .max(15, "ID is too long")
    .regex(/^\d+$/, "ID must be a positive integer")
    .transform(Number)
    .refine((val) => Number.isSafeInteger(val) && val > 0, {
      message: "ID must be a positive safe integer",
    }),
});

export const orderPaymentParamSchema = z.object({
  orderId: z
    .string()
    .max(15, "Order ID is too long")
    .regex(/^\d+$/, "Order ID must be a positive integer")
    .transform(Number)
    .refine((val) => Number.isSafeInteger(val) && val > 0, {
      message: "Order ID must be a positive safe integer",
    }),
  paymentId: z
    .string()
    .max(15, "Payment ID is too long")
    .regex(/^\d+$/, "Payment ID must be a positive integer")
    .transform(Number)
    .refine((val) => Number.isSafeInteger(val) && val > 0, {
      message: "Payment ID must be a positive safe integer",
    }),
});

export const paymentCancelSchema = z.object({
  reason: z.string().trim().max(500, "Reason cannot exceed 500 characters").optional(),
});

export const publicTokenParamSchema = z.object({
  token: z.string().min(1, "Token is required").max(100, "Token is too long"),
});

export const passwordSchema = z
  .string({
    error: "Password is required",
  })
  .min(8, "Password must be at least 8 characters long")
  .refine((val) => Buffer.byteLength(val, "utf8") <= 72, {
    message: "Password cannot exceed 72 UTF-8 bytes",
  });

export const loginSchema = z.object({
  email: z
    .string()
    .max(255, "Email cannot exceed 255 characters")
    .email("Invalid email address")
    .transform((val) => val.trim().toLowerCase()),
  password: passwordSchema,
});

export const ownerRegisterSchema = z.object({
  name: z
    .string({
      error: "Owner name is required",
    })
    .transform((val) => val.trim())
    .refine((val) => val.length > 0, {
      message: "Owner name is required and cannot be empty",
    })
    .refine((val) => val.length <= 100, {
      message: "Owner name cannot exceed 100 characters",
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
      const trimmed = val.trim();
      return trimmed.length > 0 ? trimmed : null;
    }),
  password: passwordSchema,
  confirmPassword: z.string({
    error: "Confirm password is required",
  }).refine((val) => Buffer.byteLength(val, "utf8") <= 72, {
    message: "Password cannot exceed 72 UTF-8 bytes",
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1, "Page must be at least 1").default(1),
  limit: z.coerce.number().int().min(1, "Limit must be at least 1").max(100, "Limit cannot exceed 100").default(50),
  search: z.string().max(100, "Search query cannot exceed 100 characters").optional(),
  status: z.string().max(50, "Status query cannot exceed 50 characters").optional(),
  archived: z.preprocess(
    (val) => (val === undefined || val === null || val === "" ? "false" : String(val).toLowerCase()),
    z.enum(["true", "false", "all"])
  ).default("false"),
});

export type PaginationQueryInput = z.infer<typeof paginationQuerySchema>;

export const profileUpdateSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Name must be at least 1 character")
      .max(100, "Name cannot exceed 100 characters")
      .optional(),
    phone: z
      .string()
      .trim()
      .superRefine((val, ctx) => {
        const result = validateStrictIndianPhone(val);
        if (!result.isValid) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: result.message || "Invalid Indian mobile number",
          });
        }
      })
      .optional(),
    businessName: z
      .string()
      .trim()
      .max(150, "Business name cannot exceed 150 characters")
      .optional()
      .nullable()
      .transform((val) => (val === undefined ? undefined : val && val.length > 0 ? val : null)),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.phone !== undefined ||
      (data.businessName !== undefined && data.businessName !== null),
    {
      message: "At least one field (name, phone, businessName) is required",
    }
  );

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string({
      error: "Current password is required",
    }).min(1, "Current password is required"),
    newPassword: passwordSchema,
    confirmNewPassword: z.string({
      error: "Confirm new password is required",
    }),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "New password and confirmation do not match",
    path: ["confirmNewPassword"],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: "New password must be different from current password",
    path: ["newPassword"],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const orderCancelSchema = z.object({
  reason: z
    .string({
      error: "Cancellation reason is required",
    })
    .trim()
    .min(1, "Cancellation reason is required and cannot be empty")
    .max(500, "Cancellation reason cannot exceed 500 characters"),
});

export type OrderCancelInput = z.infer<typeof orderCancelSchema>;
