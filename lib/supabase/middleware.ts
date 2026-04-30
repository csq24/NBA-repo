import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { getSupabasePublicEnv } from "@/lib/supabase/env";

/** Build a `Cookie` header value from name/value pairs (decoded values → encoded header). */
function serializeCookieHeader(cookies: { name: string; value: string }[]): string {
  return cookies
    .map(({ name, value }) => `${name}=${encodeURIComponent(value)}`)
    .join("; ");
}

export async function updateSession(request: NextRequest) {
  const env = getSupabasePublicEnv();
  if (!env) {
    return NextResponse.next({
      request: { headers: new Headers(request.headers) },
    });
  }

  // Mutable copy of session cookies for this request. `NextRequest.cookies` must not be
  // relied on for writes: forward updates only via `NextResponse.next({ request: { headers } })`
  // and `response.cookies` (see @supabase/ssr design — getAll must observe setAll).
  const cookieJar = new Map(
    request.cookies.getAll().map((c) => [c.name, c.value]),
  );

  const requestHeaders = new Headers(request.headers);

  const applyCookieHeaderToRequestHeaders = () => {
    const pairs = Array.from(cookieJar.entries()).map(([name, value]) => ({
      name,
      value,
    }));
    if (pairs.length === 0) {
      requestHeaders.delete("cookie");
    } else {
      requestHeaders.set("cookie", serializeCookieHeader(pairs));
    }
  };

  applyCookieHeaderToRequestHeaders();

  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  });

  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return Array.from(cookieJar.entries()).map(([name, value]) => ({
          name,
          value,
        }));
      },
      setAll(cookiesToSet, cacheHeaders) {
        for (const { name, value } of cookiesToSet) {
          if (value === "") {
            cookieJar.delete(name);
          } else {
            cookieJar.set(name, value);
          }
        }

        applyCookieHeaderToRequestHeaders();

        supabaseResponse = NextResponse.next({
          request: { headers: requestHeaders },
        });

        for (const { name, value, options } of cookiesToSet) {
          supabaseResponse.cookies.set(name, value, options);
        }

        for (const [key, value] of Object.entries(cacheHeaders)) {
          supabaseResponse.headers.set(key, value);
        }
      },
    },
  });

  /** Avoid hanging the whole app when Supabase is unreachable (scoreboard server actions would never return). */
  const AUTH_CHECK_MS = 5000;
  try {
    await Promise.race([
      supabase.auth.getUser(),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Supabase auth.getUser() timed out")), AUTH_CHECK_MS);
      }),
    ]);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[middleware] Supabase session refresh skipped:", msg);
  }

  return supabaseResponse;
}
