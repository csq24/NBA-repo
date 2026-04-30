"use client";

import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import Link from "next/link";

type NavbarProps = {
  /** Set from the root layout using `hasClerkConfigured()` so the bar works without Clerk env. */
  authEnabled: boolean;
};

export function Navbar({ authEnabled }: NavbarProps) {
  return (
    <nav className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-zinc-800 bg-zinc-950/90 px-4 py-3 backdrop-blur-sm">
      <Link href="/" className="text-sm font-semibold tracking-tight text-white hover:text-zinc-200">
        Scoreboard
      </Link>

      <div className="flex items-center gap-2">
        {authEnabled ? (
          <>
            <SignedIn>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
            <SignedOut>
              <Link
                href="/sign-in"
                className="rounded-full border border-zinc-600 px-3 py-1.5 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-900"
              >
                Sign in
              </Link>
              <Link
                href="/sign-up"
                className="rounded-full bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 transition hover:bg-zinc-200"
              >
                Sign up
              </Link>
            </SignedOut>
          </>
        ) : (
          <span className="hidden text-right text-xs text-zinc-600 sm:inline sm:max-w-[14rem]">
            Sign-in optional — add Clerk keys in <code className="text-zinc-500">.env.local</code> to enable auth.
          </span>
        )}
      </div>
    </nav>
  );
}
