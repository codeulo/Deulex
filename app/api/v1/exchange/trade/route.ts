import {
  checkIdempotency,
  storeIdempotencyResponse,
} from "@/lib/middlewares/idempotency";
import { unauthorizedResponse, validateJWT } from "@/lib/middlewares/jwt-auth.";
import { checkRateLimit, rateLimiters } from "@/lib/middlewares/rate-limit";
import { logAuditEvent } from "@/lib/services/audit.service";
import { executeTrade } from "@/lib/services/trade.service";
import { TradeRequestSchema } from "@/lib/validators/trade.schema";
import { NextRequest, NextResponse } from "next/server";

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

    // Step 2: Check rate limit
    const rateLimitCheck = await checkRateLimit(
      req,
      rateLimiters.trade,
      user.id
    );

    if (rateLimitCheck.limited) {
      // Log rate limit event
      await logAuditEvent({
        user_id: user.id,
        event_type: "rate_limit_exceeded",
        event_category: "security",
        severity: "warning",
        ip_address:
          req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip"),
        user_agent: req.headers.get("user-agent"),
        event_data: { endpoint: "/api/v1/exchange/trade" },
      });

      return rateLimitCheck.response;
    }

    // Step 3: Parse and validate request body
    const body = await req.json();
    const validation = TradeRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "VALIDATION_ERROR",
          message: "Invalid request data",
          details: validation.error.flatten(),
        },
        { status: 400 }
      );
    }

    const validatedData = validation.data;

    // Step 4: Check idempotency
    const idempotencyCheck = await checkIdempotency(
      req,
      user.id,
      "/api/v1/exchange/trade",
      validatedData
    );

    if (idempotencyCheck.isDuplicate) {
      return NextResponse.json(idempotencyCheck.existingResponse, {
        status: 200,
        headers: {
          "X-Idempotency-Status": "HIT",
        },
      });
    }

    // Step 5: Execute trade
    const tradeResult = await executeTrade({
      userId: user.id,
      requestId: idempotencyCheck.requestId,
      pair: validatedData.pair,
      type: validatedData.type,
      amount: validatedData.amount,
    });

    // Step 6: Store response for idempotency
    await storeIdempotencyResponse(
      idempotencyCheck.requestId,
      201,
      tradeResult
    );

    // Step 7: Log successful trade
    await logAuditEvent({
      user_id: user.id,
      event_type: "trade_executed",
      event_category: "trade",
      severity: "info",
      ip_address:
        req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip"),
      user_agent: req.headers.get("user-agent"),
      event_data: {
        trade_id: tradeResult.trade_id,
        pair: validatedData.pair,
        type: validatedData.type,
        amount: validatedData.amount,
      },
    });

    return NextResponse.json(tradeResult, {
      status: 201,
      headers: {
        "X-Request-ID": idempotencyCheck.requestId,
      },
    });
  } catch (error: any) {
    // Log error
    await logAuditEvent({
      user_id: user?.id || "unknown",
      event_type: "trade_failed",
      event_category: "trade",
      severity: "critical",
      ip_address:
        req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip"),
      user_agent: req.headers.get("user-agent"),
      event_data: {
        error: error.message,
        stack: error.stack,
      },
    });

    return NextResponse.json(
      {
        error: "TRADE_EXECUTION_FAILED",
        message: error.message || "Failed to execute trade",
      },
      { status: 500 }
    );
  }
}
