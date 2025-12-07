import {
  checkIdempotency,
  storeIdempotencyResponse,
} from "@/lib/middlewares/idempotency";
import { unauthorizedResponse, validateJWT } from "@/lib/middlewares/jwt-auth.";
import { checkRateLimit, rateLimiters } from "@/lib/middlewares/rate-limit";
import { type NextRequest, NextResponse } from "next/server";

import { logAuditEvent } from "@/lib/services/audit.service";
import { executeBillPayment } from "@/lib/services/bills.service";
import { payBillSchema } from "@/lib/validators/bills.schema";

export async function POST(req: NextRequest) {
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
      await logAuditEvent({
        user_id: user.id,
        event_type: "rate_limit_exceeded",
        event_category: "security",
        severity: "warning",
        ip_address:
          req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip"),
        user_agent: req.headers.get("user-agent"),
        event_data: { endpoint: "/api/v1/bills/pay" },
      });

      return rateLimitCheck.response!;
    }

    // Step 3: Parse request body
    const body = await req.json();
    const idempotencyKey = req.headers.get("x-request-id");

    // Step 4: Check idempotency
    if (idempotencyKey) {
      const idempotencyResult = await checkIdempotency(
        req,
        user.id,
        "/api/v1/bills/pay",
        body
      );

      if (
        !idempotencyResult.isDuplicate &&
        idempotencyResult.existingResponse
      ) {
        return NextResponse.json(idempotencyResult.existingResponse, {
          status: idempotencyResult.existingResponse.status,
        });
      }
    }

    // Step 5: Validate input
    const validation = payBillSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: "VALIDATION_ERROR",
          message: "Invalid bill payment data",
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    // Step 6: Execute bill payment
    const payment = await executeBillPayment({
      userId: user.id,
      requestId:
        idempotencyKey ||
        `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      categoryId: validation.data.category,
      amount: validation.data.amount,
      fiatWalletId: validation.data.fiatWalletId,
      recipientDetails: validation.data.recipientDetails,
    });

    const responsePayload = {
      message: "Bill payment successful",
      payment,
    };

    // Step 7: Store idempotency response
    if (idempotencyKey) {
      await storeIdempotencyResponse(idempotencyKey, 201, responsePayload);
    }

    // Step 8: Audit log successful payment
    await logAuditEvent({
      user_id: user.id,
      event_type: "bill_payment_success",
      event_category: "bills",
      severity: "info",
      ip_address:
        req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip"),
      user_agent: req.headers.get("user-agent"),
      event_data: { payment },
    });

    return NextResponse.json(responsePayload, { status: 201 });
  } catch (error: any) {
    console.error("[v0] Bill payment error:", error);

    // Audit log failed payment
    await logAuditEvent({
      user_id: user?.id || "unknown",
      event_type: "bill_payment_failed",
      event_category: "bills",
      severity: "critical",
      ip_address:
        req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip"),
      user_agent: req.headers.get("user-agent"),
      event_data: { error: error.message, stack: error.stack },
    });

    if (error instanceof Error && error.message.includes("Insufficient")) {
      return NextResponse.json(
        { error: error.message, code: "INSUFFICIENT_FUNDS" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
