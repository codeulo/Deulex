import { env } from "@/config/env.schema";
import { createClient } from "@supabase/supabase-js";

// Admin client - ONLY for background jobs and migrations
// NEVER use in API routes directly exposed to clients
export const supabaseAdmin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
