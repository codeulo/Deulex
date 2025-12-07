import { env } from "@/config/env.schema";
import { createClient } from "@supabase/supabase-js";

// Client for API routes with user JWT
export function createSupabaseClient(token: string) {
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    }
  );
}

// Get user from token
export async function getUserFromToken(token: string) {
  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  return { user, error };
}
