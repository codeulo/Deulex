import { z } from "zod";

export const depositFiatSchema = z.object({
  currency: z.string().min(1), // e.g., "NGN", "USD"
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Invalid amount format")
    .transform((val) => parseFloat(val)),
  payment_method: z.enum(["bank_transfer", "card", "ussd"]), // adjust methods as needed
  payment_reference: z.string().optional(),
});
