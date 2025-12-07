import {
  checkIdempotency,
  storeIdempotencyResponse,
} from "@/lib/middlewares/idempotency";
import { checkRateLimit, rateLimiters } from "@/lib/middlewares/rate-limit";
import { logAuditEvent } from "@/lib/services/audit.service";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabasePublic } from "@/lib/supabase/public";
import { registerSchema } from "@/lib/validators/auth.schema";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  let createdUserId: string | null = null;

  try {
    // -------------------------------
    // 1. Extract client IP & user agent
    // -------------------------------
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0] ||
      req.headers.get("x-real-ip") ||
      "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    // -------------------------------
    // 2. Rate-limit by IP address
    // -------------------------------
    const rateLimitCheck = await checkRateLimit(
      req,
      rateLimiters.authRegister,
      ip
    );

    if (rateLimitCheck.limited) {
      await logAuditEvent({
        user_id: null,
        event_type: "rate_limit_exceeded",
        event_category: "security",
        severity: "warning",
        ip_address: ip,
        user_agent: userAgent,
        event_data: { endpoint: "/api/v1/auth/register" },
      });

      return rateLimitCheck.response!;
    }

    // -------------------------------
    // 3. Validate request body
    // -------------------------------
    const body = await req.json();
    const validation = registerSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "VALIDATION_ERROR",
          message: "Invalid registration data",
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { email, password, phone } = validation.data;

    // -------------------------------
    // 4. Idempotency check (unique per email)
    // -------------------------------
    const idempotencyCheck = await checkIdempotency(
      req,
      email,
      "/api/v1/auth/register",
      validation.data
    );

    if (idempotencyCheck.isDuplicate) {
      return NextResponse.json(idempotencyCheck.existingResponse, {
        status: 200,
        headers: { "X-Idempotency-Status": "HIT" },
      });
    }

    // -------------------------------
    // 5. Create user through Supabase auth
    // -------------------------------
    const { data, error } = await supabasePublic.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo:
          process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ||
          `${req.nextUrl.origin}/auth/verify`,
        data: { phone: phone ?? null },
      },
    });

    if (error) {
      await logAuditEvent({
        user_id: null,
        event_type: "registration_failed",
        event_category: "auth",
        severity: "warning",
        ip_address: ip,
        user_agent: userAgent,
        metadata: { email, error: error.message },
      });

      return NextResponse.json(
        { error: error.message, code: "AUTH_ERROR" },
        { status: 400 }
      );
    }

    createdUserId = data.user?.id ?? null;

    // -------------------------------
    // 6. Create user profile in users table
    // -------------------------------
    if (createdUserId) {
      const { error: profileError } = await supabaseAdmin.from("users").insert({
        id: createdUserId,
        email,
        full_name: body.full_name ?? "",
        phone_number: phone,
        phone_verified: false,
        kyc_status: "pending",
        kyc_tier: 1,
        two_fa_enabled: false,
        two_fa_secret: null,
        account_status: "active",
      });

      if (profileError) {
        console.error("Failed to create user profile:", profileError);
        throw new Error("Failed to create user profile");
      }
    }

    // -------------------------------
    // 7. Store idempotent response
    // -------------------------------
    const responsePayload = {
      message:
        "Registration successful. Please check your email to verify your account.",
      user: { id: createdUserId, email: data.user?.email },
    };

    await storeIdempotencyResponse(
      idempotencyCheck.requestId,
      201,
      responsePayload
    );

    // -------------------------------
    // 8. Audit log success
    // -------------------------------
    await logAuditEvent({
      user_id: createdUserId,
      event_type: "registration_success",
      event_category: "auth",
      severity: "info",
      ip_address: ip,
      user_agent: userAgent,
      metadata: { email },
    });

    // -------------------------------
    // 9. Return success response
    // -------------------------------
    return NextResponse.json(responsePayload, {
      status: 201,
      headers: { "X-Request-ID": idempotencyCheck.requestId },
    });
  } catch (error: any) {
    // -------------------------------
    // 10. Audit log critical failure
    // -------------------------------
    await logAuditEvent({
      user_id: createdUserId,
      event_type: "registration_error",
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
        error: "REGISTRATION_FAILED",
        message: error.message || "Registration failed",
      },
      { status: 500 }
    );
  }
}
