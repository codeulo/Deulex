import { NextRequest, NextResponse } from "next/server";
import { validateJWT } from "./jwt-auth.";

export async function withAuth(
  req: NextRequest,
  handler: (req: NextRequest, context: { user: any }) => Promise<NextResponse>
) {
  const { user, error } = await validateJWT(req);

  if (error || !user) {
    return NextResponse.json(
      { error: "UNAUTHORIZED", message: error || "Authentication required" },
      { status: 401 }
    );
  }

  return handler(req, { user });
}
