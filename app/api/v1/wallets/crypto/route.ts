import { unauthorizedResponse, validateJWT } from "@/lib/middlewares/jwt-auth.";
import { checkRateLimit, rateLimiters } from "@/lib/middlewares/rate-limit";
import { getCryptoWallets } from "@/lib/services/wallets.service";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  let user: any = null;

  try {
    // Step 1: Authenticate
    const authResult = await validateJWT(req);
    user = authResult.user;

    if (!user) {
      return unauthorizedResponse(
        authResult.error || "Authentication required"
      );
    }

    // Step 2: Check rate limit
    const rateLimitCheck = await checkRateLimit(
      req,
      rateLimiters.trade,
      user.id
    ); // or rateLimiters.wallet if defined

    if (rateLimitCheck.limited) {
      return rateLimitCheck.response!;
    }

    // Step 3: Fetch user crypto wallets
    const wallets = await getCryptoWallets(user.id);

    return NextResponse.json(
      { wallets },
      {
        status: 200,
        headers: {
          "X-RateLimit-Limit": "N/A",
          "X-RateLimit-Remaining": "N/A",
          "X-RateLimit-Reset": "N/A",
        },
      }
    );
  } catch (error) {
    console.error("[v0] Get crypto wallets error:", error);

    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
