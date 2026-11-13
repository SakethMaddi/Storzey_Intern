import { z } from "zod";

/**
 * Validates password:
 * - At least 8 characters
 * - Max 72 UTF-8 bytes (Bcrypt limit)
 */
export const passwordSchema = z
  .string({
    error: "Password is required",
  })
  .min(8, "Password must be at least 8 characters long")
  .refine(
    (val) => {
      try {
        return new TextEncoder().encode(val).length <= 72;
      } catch {
        return val.length <= 72;
      }
    },
    {
      message: "Password cannot exceed 72 UTF-8 bytes",
    }
  );

export const loginSchema = z.object({
  email: z
    .string({
      error: "Email is required",
    })
    .max(255, "Email cannot exceed 255 characters")
    .transform((val) => val.trim().toLowerCase())
    .pipe(z.string().email("Please enter a valid email address")),
  password: passwordSchema,
});

export type LoginFormData = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    name: z
      .string({
        error: "Name is required",
      })
      .trim()
      .min(1, "Name is required")
      .max(100, "Name cannot exceed 100 characters"),
    email: z
      .string({
        error: "Email is required",
      })
      .max(255, "Email cannot exceed 255 characters")
      .transform((val) => val.trim().toLowerCase())
      .pipe(z.string().email("Please enter a valid email address")),
    phone: z.string().optional(),
    businessName: z.string().optional(),
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type RegisterFormData = z.infer<typeof registerSchema>;
