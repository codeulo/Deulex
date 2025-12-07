import {
  checkIdempotency,
  storeIdempotencyResponse,
} from "@/lib/middlewares/idempotency";
import { unauthorizedResponse, validateJWT } from "@/lib/middlewares/jwt-auth.";
import { checkRateLimit, rateLimiters } from "@/lib/middlewares/rate-limit";
import { logAuditEvent } from "@/lib/services/audit.service";
import { initiateFiatDeposit } from "@/lib/services/wallets.service";
import { depositFiatSchema } from "@/lib/validators/deposit-fiat.schema";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  let user: any = null;

  try {
    // 1. Authenticate
    const authResult = await validateJWT(req);
    user = authResult.user;
    if (!user)
      return unauthorizedResponse(
        authResult.error || "Authentication required"
      );

    // 2. Rate limit
    const rateLimitCheck = await checkRateLimit(
      req,
      rateLimiters.wallet,
      user.id
    );
    if (rateLimitCheck.limited) return rateLimitCheck.response!;

    const body = await req.json();
    const idempotencyKey = req.headers.get("x-request-id");

    // 3. Idempotency
    if (idempotencyKey) {
      const idempotencyResult = await checkIdempotency(
        req,
        user.id,
        "/api/v1/wallets/deposit/fiat",
        body
      );
      if (idempotencyResult.isDuplicate && idempotencyResult.existingResponse) {
        return NextResponse.json(idempotencyResult.existingResponse, {
          status: 200,
          headers: { "X-Idempotency-Status": "HIT" },
        });
      }
    }

    // 4. Validate input
    const validation = depositFiatSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          code: "VALIDATION_ERROR",
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { currency, amount, payment_method } = validation.data;

    // 5. Initiate deposit
    const deposit = await initiateFiatDeposit({
      userId: user.id,
      amount: amount.toString(),
      currency,
      paymentMethod: payment_method,
    });

    // 6. Log audit
    await logAuditEvent({
      user_id: user.id,
      event_type: "fiat_deposit_initiated",
      event_category: "wallet",
      severity: "info",
      event_data: {
        deposit_id: deposit.deposit_id,
        amount,
        currency,
        payment_method,
      },
    });

    // 7. Store idempotency response
    if (idempotencyKey) {
      await storeIdempotencyResponse(idempotencyKey, 201, deposit);
    }

    return NextResponse.json(deposit, {
      status: 201,
      headers: { "X-Idempotency-Status": idempotencyKey ? "STORED" : "N/A" },
    });
  } catch (error) {
    console.error("[v0] Fiat deposit error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
