import { NextRequest, NextResponse } from "next/server";

import { checkRateLimit, rateLimiters } from "@/lib/middlewares/rate-limit";
import { logAuditEvent } from "@/lib/services/audit.service";
import { supabasePublic } from "@/lib/supabase/public";
import { loginSchema } from "@/lib/validators/auth.schema";
import z from "zod";

export async function POST(req: NextRequest) {
  let authenticatedUserId: string | null = null;

  try {
    // -------------------------------------------------------
    // 1. Extract IP + User Agent
    // -------------------------------------------------------
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0] ||
      req.headers.get("x-real-ip") ||
      "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    // -------------------------------------------------------
    // 2. Rate limit login attempts by IP
    // -------------------------------------------------------
    const rateLimitCheck = await checkRateLimit(
      req,
      rateLimiters.authLogin,
      ip
    );

    if (rateLimitCheck.limited) {
      await logAuditEvent({
        user_id: null,
        event_type: "login_rate_limited",
        event_category: "security",
        severity: "warning",
        ip_address: ip,
        user_agent: userAgent,
        metadata: { ip },
      });

      return rateLimitCheck.response!;
    }

    // -------------------------------------------------------
    // 3. Parse + validate login body
    // -------------------------------------------------------
    const body = await req.json();
    const validation = loginSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "VALIDATION_ERROR",
          message: "Invalid login input",
          details: z.treeifyError(validation.error),
        },
        { status: 400 }
      );
    }

    const { email, password } = validation.data;

    // -------------------------------------------------------
    // 4. Perform Supabase login
    // -------------------------------------------------------
    const { data, error } = await supabasePublic.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      await logAuditEvent({
        user_id: null,
        event_type: "login_failed",
        event_category: "auth",
        severity: "warning",
        ip_address: ip,
        user_agent: userAgent,
        metadata: { email, error: error?.message },
      });

      return NextResponse.json(
        {
          error: "INVALID_CREDENTIALS",
          message: "Invalid email or password",
        },
        { status: 401 }
      );
    }

    authenticatedUserId = data.user.id;

    // -------------------------------------------------------
    // 5. Check 2FA
    // -------------------------------------------------------
    const { data: twoFAData } = await supabasePublic
      .from("users")
      .select("two_factor_enabled")
      .eq("id", authenticatedUserId)
      .single();

    if (twoFAData?.two_factor_enabled) {
      return NextResponse.json(
        {
          message: "2FA verification required",
          requires_2fa: true,
          session_token: data.session?.access_token,
        },
        { status: 200 }
      );
    }

    // -------------------------------------------------------
    // 6. Audit log successful login
    // -------------------------------------------------------
    await logAuditEvent({
      user_id: authenticatedUserId,
      event_type: "login_success",
      event_category: "auth",
      severity: "info",
      ip_address: ip,
      user_agent: userAgent,
      metadata: { email },
    });

    // -------------------------------------------------------
    // 7. Return login response
    // -------------------------------------------------------
    return NextResponse.json(
      {
        message: "Login successful",
        user: {
          id: authenticatedUserId,
          email: data.user.email,
        },
        session: {
          access_token: data.session?.access_token,
          refresh_token: data.session?.refresh_token,
          expires_at: data.session?.expires_at,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    // -------------------------------------------------------
    // 8. Log unexpected errors
    // -------------------------------------------------------
    await logAuditEvent({
      user_id: authenticatedUserId,
      event_type: "login_error",
      event_category: "auth",
      severity: "critical",
      ip_address:
        req.headers.get("x-forwarded-for") ||
        req.headers.get("x-real-ip") ||
        null,
      user_agent: req.headers.get("user-agent") || null,
      event_data: { error: error.message, stack: error.stack },
    });

    return NextResponse.json(
      {
        error: "INTERNAL_ERROR",
        message: "Unexpected login error",
      },
      { status: 500 }
    );
  }
}
