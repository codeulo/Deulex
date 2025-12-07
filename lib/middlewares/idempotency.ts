import { supabaseAdmin } from "@/lib/supabase/admin";
import { createHash } from "crypto";
import { NextRequest } from "next/server";

// Routes where client is NOT required to send X-Request-ID
const NON_STRICT_ROUTES = [
  "/api/v1/auth/register",
  "/api/v1/auth/login",
  "/api/v1/auth/verify",
  "/api/v1/auth/reset",
];

// Validate UUIDv4
const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface IdempotencyResult {
  isDuplicate: boolean;
  existingResponse?: any;
  requestId: string;
}

export async function checkIdempotency(
  req: NextRequest,
  userScope: string, // userId or email
  route: string,
  requestBody: any
): Promise<IdempotencyResult> {
  let requestId = req.headers.get("x-request-id");
  const isNonStrict = NON_STRICT_ROUTES.includes(route);

  // ----------------------------------------------------------------
  // 1. Handle missing header
  // ----------------------------------------------------------------
  if (!requestId) {
    if (isNonStrict) {
      requestId = crypto.randomUUID();
    } else {
      throw new Error("X-Request-ID header is required");
    }
  }

  // ----------------------------------------------------------------
  // 2. Validate UUID (only for strict routes)
  // ----------------------------------------------------------------
  if (!isNonStrict && !uuidRegex.test(requestId)) {
    throw new Error("X-Request-ID must be valid UUID v4");
  }

  // ----------------------------------------------------------------
  // 3. Normalize and hash request body
  // ----------------------------------------------------------------
  const normalizedBody = JSON.stringify(
    JSON.parse(JSON.stringify(requestBody))
  );
  const requestHash = createHash("sha256").update(normalizedBody).digest("hex");

  // ----------------------------------------------------------------
  // 4. Lock existing row if exists (RPC)
  // ----------------------------------------------------------------
  const { data: lockedExisting, error: lockError } = await supabaseAdmin.rpc(
    "lock_idempotency_key",
    {
      p_request_id: requestId,
      p_user_scope: userScope,
      p_route: route,
    }
  );

  if (lockError && lockError.code !== "PGRST116") {
    console.error("IDEMPOTENCY LOCK ERROR:", lockError);
    throw new Error("Failed to lock idempotency key");
  }

  // ----------------------------------------------------------------
  // 5. If row exists → validate + return cached response
  // ----------------------------------------------------------------
  if (lockedExisting) {
    if (!isNonStrict) {
      // Strict routes: enforce payload equality & lock
      if (lockedExisting.request_hash !== requestHash) {
        throw new Error("Idempotency key reused with different payload");
      }

      if (lockedExisting.response_body) {
        return {
          isDuplicate: true,
          existingResponse: lockedExisting.response_body,
          requestId,
        };
      }

      // Still processing (concurrent request)
      return {
        isDuplicate: true,
        existingResponse: {
          error: "REQUEST_PROCESSING",
          message: "Request is currently being processed",
        },
        requestId,
      };
    } else {
      // Non-strict routes: treat as new request, ignore placeholder
      console.log(
        `[Idempotency] Non-strict route "${route}" has existing row; ignoring placeholder`
      );
    }
  }

  // ----------------------------------------------------------------
  // 6. Insert placeholder for NEW idempotency key
  // ----------------------------------------------------------------
  const expiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();

  const { error: insertError } = await supabaseAdmin
    .from("idempotency_keys")
    .insert({
      request_id: requestId,
      user_scope: userScope,
      route,
      request_hash: requestHash,
      expires_at: expiresAt,
      status: "PROCESSING",
    });

  if (insertError) {
    // Ignore duplicate-key error if another process inserted the same idempotency key concurrently
    // Postgres unique violation returns code '23505'
    if (insertError.code === "23505") {
      // another worker reserved the key already — proceed without throwing
    } else {
      console.error("IDEMPOTENCY INSERT ERROR:", insertError);
      throw new Error("Failed to reserve idempotency key");
    }
  }

  return {
    isDuplicate: false,
    requestId,
  };
}

// const { error: insertError } = await supabaseAdmin
//   .from("idempotency_keys")
//   .upsert(
//     {
//       request_id: requestId,
//       user_scope: userScope,
//       route,
//       request_hash: requestHash,
//       expires_at: expiresAt,
//       status: "PROCESSING",
//     },
//     {
//       onConflict: "request_id,user_scope,route", // pass as string
//     }
//   );

// if (insertError) {
//   console.error("IDEMPOTENCY INSERT ERROR:", insertError);
//   throw new Error("Failed to reserve idempotency key");
// }

// ----------------------------------------------------------------
// 7. Store response AFTER endpoint completes
// ----------------------------------------------------------------
export async function storeIdempotencyResponse(
  requestId: string,
  statusCode: number,
  responseBody: any
): Promise<void> {
  await supabaseAdmin
    .from("idempotency_keys")
    .update({
      status: "COMPLETED",
      response_status: statusCode,
      response_body: responseBody,
      updated_at: new Date().toISOString(),
    })
    .eq("request_id", requestId);
}
