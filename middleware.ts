import { clerkMiddleware } from "@clerk/nextjs/server";
import { type NextFetchEvent, type NextRequest, NextResponse } from "next/server";

import { hasClerkConfigured } from "@/lib/clerk/env";
import { updateSession } from "@/lib/supabase/middleware";

/** Clerk reads `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY` from env (explicit options broke Edge validation). */
const withClerk = clerkMiddleware(async (_auth, request: NextRequest) => updateSession(request));

export default function middleware(request: NextRequest, event: NextFetchEvent) {
  // Next.js matchers cannot use (?!…) lookaheads on API paths; bypass here so cron JSON is not wrapped by Clerk/Supabase.
  if (request.nextUrl.pathname === "/api/sync-boxscore") {
    return NextResponse.next();
  }
  if (!hasClerkConfigured()) {
    return updateSession(request);
  }
  return withClerk(request, event);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api)(.*)",
  ],
};
