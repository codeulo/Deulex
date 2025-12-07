import { unauthorizedResponse, validateJWT } from "@/lib/middlewares/jwt-auth.";
import { checkRateLimit, rateLimiters } from "@/lib/middlewares/rate-limit";
import {
  getFiatWallets,
  initiateFiatDeposit,
} from "@/lib/services/wallets.service";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  let user: any = null;

  try {
    // Step 1: Authenticate
    const authResult = await validateJWT(req);
    user = authResult.user;
    if (!user)
      return unauthorizedResponse(
        authResult.error || "Authentication required"
      );

    // Step 2: Rate limit
    const rateLimitCheck = await checkRateLimit(
      req,
      rateLimiters.wallet,
      user.id
    );
    if (rateLimitCheck.limited) return rateLimitCheck.response!;

    // Step 3: Ensure default fiat wallets exist
    const existingWallets = await getFiatWallets(user.id);
    const existingCurrencies = existingWallets.map((w) => w.currency);

    if (!existingCurrencies.includes("NGN")) {
      await initiateFiatDeposit({
        userId: user.id,
        amount: "0.00",
        currency: "NGN",
        paymentMethod: "SYSTEM",
      });
    }

    if (!existingCurrencies.includes("USD")) {
      await initiateFiatDeposit({
        userId: user.id,
        amount: "0.00",
        currency: "USD",
        paymentMethod: "SYSTEM",
      });
    }

    const wallets = await getFiatWallets(user.id);

    return NextResponse.json({ wallets }, { status: 200 });
  } catch (error) {
    console.error("[v0] Get fiat wallets error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
