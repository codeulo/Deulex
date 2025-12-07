import { z } from "zod";

const SUPPORTED_PAIRS = ["BTC-NGN", "ETH-NGN", "USDT-NGN", "USDC-NGN"] as const;

export const TradeRequestSchema = z.object({
  pair: z.enum(SUPPORTED_PAIRS, { message: "Invalid trading pair" }),
  type: z.enum(["BUY", "SELL"], { message: "Type must be BUY or SELL" }),
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,4})?$/, "Invalid amount format")
    .refine((amt) => {
      const num = parseFloat(amt);
      return num > 0 && num <= 100000000;
    }, "Amount must be positive and within limits"),
});

export type TradeRequest = z.infer<typeof TradeRequestSchema>;

export const TradeResponseSchema = z.object({
  trade_id: z.string().uuid(),
  pair: z.string(),
  type: z.enum(["BUY", "SELL"]),
  amount_base: z.string(),
  amount_quote: z.string(),
  execution_price: z.string(),
  fee: z.string(),
  status: z.enum(["pending", "executed", "failed", "cancelled"]),
  executed_at: z.string().datetime(),
});

export type TradeResponse = z.infer<typeof TradeResponseSchema>;
