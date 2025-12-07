import { z } from "zod";

const envSchema = z.object({
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // Redis
  UPSTASH_REDIS_REST_URL: z.url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),

  // Payment Gateways
  PAYSTACK_SECRET_KEY: z.string().min(1),
  FLUTTERWAVE_SECRET_KEY: z.string().min(1).optional(),

  // App
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  API_BASE_URL: z.url(),
  JWT_SECRET: z.string().min(32),

  // Logging
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type Env = z.infer<typeof envSchema>;

export const env = envSchema.parse(process.env);
