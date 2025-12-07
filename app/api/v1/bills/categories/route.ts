import { unauthorizedResponse, validateJWT } from "@/lib/middlewares/jwt-auth.";
import { checkRateLimit, rateLimiters } from "@/lib/middlewares/rate-limit";
import { logAuditEvent } from "@/lib/services/audit.service";
import { getBillCategories } from "@/lib/services/bills.service";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  let user: any = null;
  let authError: any = null;

  try {
    // Step 1: Authenticate user
    const authResult = await validateJWT(req);
    user = authResult.user;
    authError = authResult.error;

    if (authError || !user) {
      return unauthorizedResponse(authError || "Authentication required");
    }

    // Step 2: Rate limit by user ID
    const rateLimitCheck = await checkRateLimit(
      req,
      rateLimiters.billPayment,
      user.id
    );

    if (rateLimitCheck.limited) {
      // Optional: log rate-limit events
      await logAuditEvent({
        user_id: user.id,
        event_type: "rate_limit_exceeded",
        event_category: "security",
        severity: "warning",
        ip_address:
          req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip"),
        user_agent: req.headers.get("user-agent"),
        event_data: { endpoint: "/api/v1/bills/categories" },
      });

      return rateLimitCheck.response!;
    }

    // Step 3: Fetch bill categories
    const categories = await getBillCategories();

    // Step 4: Return response
    return NextResponse.json(
      { categories },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, max-age=300",
        },
      }
    );
  } catch (error) {
    console.error("[v0] Get bill categories error:", error);

    // Optional: audit log failure
    await logAuditEvent({
      user_id: user?.id || "unknown",
      event_type: "get_bill_categories_failed",
      event_category: "payment",
      severity: "critical",
      ip_address:
        req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip"),
      user_agent: req.headers.get("user-agent"),
      event_data: {
        error: (error as any).message,
        stack: (error as any).stack,
      },
    });

    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
