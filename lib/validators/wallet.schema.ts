import { z } from "zod";

export const withdrawCryptoSchema = z.object({
  asset_id: z.number({
    error: "Asset ID is required",
    message: "Asset ID must be a number",
  }),
  amount: z
    .string({
      error: "Amount is required",
      message: "Amount must be a string representing a number",
    })
    .refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
      message: "Amount must be a positive number",
    }),
  to_address: z.string({
    error: "Destination address is required",
  }),
  network: z.string({
    error: "Network is required",
  }),
  two_factor_code: z.string().length(6, "2FA code must be 6 digits").optional(),
});
