import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getSupabasePublicEnv, requireSupabasePublicEnv } from "@/lib/supabase/env";

function createServerClientWithCookies(url: string, anonKey: string): SupabaseClient {
  const cookieStore = cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Called from a Server Component without mutable cookies; middleware refreshes session.
        }
      },
    },
  });
}

/** Supabase server client, or `null` when public env vars are not configured. */
export function tryCreateClient(): SupabaseClient | null {
  const env = getSupabasePublicEnv();
  if (!env) return null;
  return createServerClientWithCookies(env.url, env.anonKey);
}

export function createClient() {
  const { url, anonKey } = requireSupabasePublicEnv();
  return createServerClientWithCookies(url, anonKey);
}
