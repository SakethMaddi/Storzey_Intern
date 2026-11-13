import { z } from "zod";

function capitalizeFirstLetter(val: string): string {
  if (!val) return val;
  return val.replace(/^(\s*)([\p{L}])/u, (_, space, char) => space + char.toUpperCase());
}

export const orderFormSchema = z
  .object({
    itemName: z
      .string({
        error: "Item name is required",
      })
      .transform((val) => capitalizeFirstLetter(val.trim()))
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
        message: "Total amount must be an integer",
      })
      .refine((val) => val > 0, {
        message: "Total amount must be greater than zero",
      }),
    advance: z
      .number({
        error: "Advance amount must be a number",
      })
      .refine(Number.isSafeInteger, {
        message: "Advance amount must be an integer",
      })
      .refine((val) => val >= 0, {
        message: "Advance amount cannot be negative",
      }),
    customerId: z
      .number({
        error: "Customer is required",
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
          message: "Date must be in YYYY-MM-DD format",
        }
      ),
    stages: z
      .array(z.string().min(1).max(50))
      .max(15, "Cannot have more than 15 stages")
      .optional(),
  })
  .refine((data) => data.advance <= data.totalAmount, {
    message: "Advance amount cannot exceed total amount",
    path: ["advance"],
  });

export type OrderFormData = z.infer<typeof orderFormSchema>;
