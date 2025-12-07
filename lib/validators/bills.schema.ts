import { z } from "zod";

export const payBillSchema = z.object({
  category: z.string(),
  amount: z
    .string()
    .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
      message: "Amount must be a positive number",
    }),
  fiatWalletId: z.string(),
  recipientDetails: z.record(z.string(), z.any()),
});
