import { NextRequest, NextResponse } from "next/server";

import { checkRateLimit, rateLimiters } from "@/lib/middlewares/rate-limit";
import { logAuditEvent } from "@/lib/services/audit.service";
import { supabasePublic } from "@/lib/supabase/public";
import { twoFactorVerifySchema } from "@/lib/validators/auth.schema";

export async function POST(req: NextRequest) {
  try {
    /* ------------------------------------------------------- */
    /* 1. Extract IP for rate limiting                         */
    /* ------------------------------------------------------- */
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0] ||
      req.headers.get("x-real-ip") ||
      "unknown";

    const rateLimitCheck = await checkRateLimit(
      req,
      rateLimiters.twoFactor,
      ip
    );

    if (rateLimitCheck.limited) {
      return rateLimitCheck.response!;
    }

    /* ------------------------------------------------------- */
    /* 2. Validate incoming body                               */
    /* ------------------------------------------------------- */
    const rawBody = await req.json();
    const validated = twoFactorVerifySchema.safeParse(rawBody);

    if (!validated.success) {
      return NextResponse.json(
        {
          error: "VALIDATION_ERROR",
          message: "Invalid 2FA code format",
          details: validated.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { token } = validated.data;

    /* ------------------------------------------------------- */
    /* 3. Get user from session                                */
    /* ------------------------------------------------------- */
    const {
      data: { user },
      error: userError,
    } = await supabasePublic.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "AUTH_REQUIRED", message: "User not authenticated" },
        { status: 401 }
      );
    }

    /* ------------------------------------------------------- */
    /* 4. Get 2FA secret from user profile                     */
    /* ------------------------------------------------------- */
    const { data: userData, error: userQueryError } = await supabasePublic
      .from("users")
      .select("two_factor_secret, two_factor_enabled")
      .eq("id", user.id)
      .single();

    if (userQueryError || !userData) {
      return NextResponse.json(
        {
          error: "USER_NOT_FOUND",
          message: "Could not retrieve user 2FA data",
        },
        { status: 400 }
      );
    }

    if (!userData.two_factor_enabled) {
      return NextResponse.json(
        {
          error: "2FA_NOT_ENABLED",
          message: "2FA is not enabled on this account",
        },
        { status: 400 }
      );
    }

    /* ------------------------------------------------------- */
    /* 5. Verify the TOTP code                                 */
    /* ------------------------------------------------------- */

    // 🔥 TODO: Replace with real TOTP verification later
    const isValid = token === "123456" || token.length === 6;

    if (!isValid) {
      await logAuditEvent({
        user_id: user.id,
        event_type: "2fa_verification_failed",
        event_category: "security",
        severity: "warning",
        ip_address: ip,
        user_agent: req.headers.get("user-agent"),
        metadata: { provided_code: token },
      });

      return NextResponse.json(
        { error: "INVALID_2FA_CODE", message: "Invalid authentication code" },
        { status: 401 }
      );
    }

    /* ------------------------------------------------------- */
    /* 6. Log success                                           */
    /* ------------------------------------------------------- */
    await logAuditEvent({
      user_id: user.id,
      event_type: "2fa_verification_success",
      event_category: "auth",
      severity: "info",
      ip_address: ip,
      user_agent: req.headers.get("user-agent"),
    });

    /* ------------------------------------------------------- */
    /* 7. Return success response                              */
    /* ------------------------------------------------------- */

    return NextResponse.json(
      {
        message: "2FA verification successful",
        verified: true,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[2FA] Error verifying 2FA:", error);

    await logAuditEvent({
      user_id: "unknown",
      event_type: "2fa_verification_error",
      event_category: "security",
      severity: "critical",
      ip_address:
        req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip"),
      user_agent: req.headers.get("user-agent"),
      event_data: { error: error.message, stack: error.stack },
    });

    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Internal server error" },
      { status: 500 }
    );
  }
}
