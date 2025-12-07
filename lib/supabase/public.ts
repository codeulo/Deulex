import { env } from "@/config/env.schema";
import { createClient } from "@supabase/supabase-js";

// Public Supabase client for auth-related operations (signup/login/reset)
export const supabasePublic = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
