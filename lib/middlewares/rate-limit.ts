import { env } from "@/config/env.schema";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextRequest, NextResponse } from "next/server";

const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
});

/**
 * Recommended 2FA Security Limits:
 *  - 2FA verify:     5 attempts per 10 minutes
 *  - 2FA enable:     3 attempts per hour
 *  - 2FA disable:    3 attempts per hour
 *  - 2FA recovery:   5 attempts per 30 minutes
 */

export const rateLimiters = {
  /** Trading-related */
  trade: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(1, "1 m"),
    analytics: true,
    prefix: "firetrade:ratelimit:trade",
  }),
  wallet: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "1 m"),
    analytics: true,
    prefix: "firetrade:ratelimit:wallet",
  }),

  billPayment: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "1 m"),
    analytics: true,
    prefix: "firetrade:ratelimit:bills",
  }),

  withdrawal: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(3, "1 h"),
    analytics: true,
    prefix: "firetrade:ratelimit:withdrawal",
  }),

  /** Auth: login */
  authLogin: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "15 m"),
    analytics: true,
    prefix: "firetrade:ratelimit:auth-login",
  }),

  /** Auth: register (hard limit: 5 accounts per IP per day) */
  authRegister: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "24 h"),
    analytics: true,
    prefix: "firetrade:ratelimit:auth-register",
  }),

  /** 2FA: verify code */
  twoFactor: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "10 m"),
    analytics: true,
    prefix: "firetrade:ratelimit:2fa-verify",
  }),

  /** 2FA: enable TOTP */
  twoFactorEnable: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(3, "1 h"),
    analytics: true,
    prefix: "firetrade:ratelimit:2fa-enable",
  }),

  /** 2FA: disable TOTP */
  twoFactorDisable: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(3, "1 h"),
    analytics: true,
    prefix: "firetrade:ratelimit:2fa-disable",
  }),

  /** 2FA: recovery codes */
  twoFactorRecovery: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "30 m"),
    analytics: true,
    prefix: "firetrade:ratelimit:2fa-recovery",
  }),
};

/**
 * Helper: Apply rate limit to a request.
 */
export async function checkRateLimit(
  req: NextRequest,
  limiter: Ratelimit,
  identifier: string
): Promise<{ limited: boolean; response?: NextResponse }> {
  const { success, limit, reset, remaining } = await limiter.limit(identifier);

  if (!success) {
    const now = Date.now();
    const retryAfter = Math.floor((reset - now) / 1000);

    return {
      limited: true,
      response: NextResponse.json(
        {
          error: "RATE_LIMIT_EXCEEDED",
          message: "Too many requests. Please try again later.",
          retry_after: retryAfter,
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": limit.toString(),
            "X-RateLimit-Remaining": remaining.toString(),
            "X-RateLimit-Reset": reset.toString(),
            "Retry-After": retryAfter.toString(),
          },
        }
      ),
    };
  }

  return { limited: false };
}
