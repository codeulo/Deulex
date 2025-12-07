import { supabaseAdmin } from "@/lib/supabase/admin";
import { getUserFromToken } from "@/lib/supabase/client";
import { NextRequest, NextResponse } from "next/server";

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
}

export interface AuthResult {
  user: AuthenticatedUser | null;
  error: string | null;
}

export async function validateJWT(req: NextRequest): Promise<AuthResult> {
  try {
    // Extract JWT from Authorization header
    const authHeader = req.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return {
        user: null,
        error: "Missing or invalid authorization header",
      };
    }

    const token = authHeader.substring(7);

    // Verify JWT with Supabase
    const { user, error } = await getUserFromToken(token);

    if (error || !user) {
      return {
        user: null,
        error: "Invalid or expired token",
      };
    }

    // Additional user checks from database
    const { data: userData, error: dbError } = await supabaseAdmin
      .from("users")
      .select("account_status, two_fa_enabled, kyc_status")
      .eq("id", user.id)
      .single();

    if (dbError || !userData) {
      return {
        user: null,
        error: "User not found",
      };
    }

    if (userData.account_status !== "active") {
      return {
        user: null,
        error: "Account suspended or closed",
      };
    }

    return {
      user: {
        id: user.id,
        email: user.email!,
        role: user.role || "authenticated",
      },
      error: null,
    };
  } catch (err) {
    return {
      user: null,
      error: "Authentication failed",
    };
  }
}

// Helper to create unauthorized response
export function unauthorizedResponse(message: string = "Unauthorized") {
  return NextResponse.json(
    {
      error: "UNAUTHORIZED",
      message,
    },
    { status: 401 }
  );
}
