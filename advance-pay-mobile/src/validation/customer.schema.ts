import { z } from "zod";

export function capitalizeFirstLetter(val: string): string {
  if (!val) return val;
  return val.replace(/^(\s*)([\p{L}])/u, (_, space, char) => space + char.toUpperCase());
}

export function validateStrictIndianPhone(input: unknown): {
  isValid: boolean;
  message?: string;
  value: string;
} {
  const str = String(input ?? "").trim();
  if (str.length === 0) {
    return { isValid: false, message: "Phone number is required", value: "" };
  }
  if (/\D/.test(str)) {
    if (str.startsWith("+91") || (str.startsWith("91") && str.length === 12)) {
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
  if (str.length !== 10) {
    return {
      isValid: false,
      message: `Phone number must be exactly 10 digits (currently ${str.length}).`,
      value: str,
    };
  }
  if (!["6", "7", "8", "9"].includes(str.charAt(0))) {
    return {
      isValid: false,
      message: "Indian mobile number must start with 6, 7, 8, or 9.",
      value: str,
    };
  }
  return { isValid: true, value: str };
}

export const customerSchema = z.object({
  name: z
    .string({
      error: "Customer name is required",
    })
    .transform((val) => capitalizeFirstLetter(val.trim()))
    .refine((val) => val.length > 0, {
      message: "Customer name is required",
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

export type CustomerFormData = z.infer<typeof customerSchema>;

export const customerFormSchema = z.object({
  name: z
    .string({ error: "Customer name is required" })
    .trim()
    .min(1, "Customer name is required")
    .max(100, "Customer name cannot exceed 100 characters"),
  phone: z
    .string({ error: "Phone number is required" })
    .trim()
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
    .or(z.literal("")),
});

export type CustomerFormInput = z.infer<typeof customerFormSchema>;
