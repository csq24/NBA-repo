import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getSupabasePublicEnv } from "@/lib/supabase/env";

/** Service-role client for cron / server jobs (bypasses RLS). Returns `null` if env is incomplete. */
export function tryCreateServiceRoleClient(): SupabaseClient | null {
  const publicEnv = getSupabasePublicEnv();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!publicEnv || !serviceKey) return null;
  return createClient(publicEnv.url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
