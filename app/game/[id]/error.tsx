"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function GameError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[game error boundary]", error);
  }, [error]);

  const message =
    error && typeof error === "object" && "message" in error && typeof (error as Error).message === "string"
      ? (error as Error).message
      : "Something went wrong loading this game.";

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-zinc-950 px-4 py-16 text-center text-zinc-100">
      <h1 className="text-lg font-semibold text-white">Game page error</h1>
      <p className="mt-2 max-w-md text-sm text-zinc-400">{message}</p>
      <p className="mt-4 max-w-md text-xs text-zinc-500">
        If you just saw “missing required error components”, stop <code className="text-zinc-400">npm run dev</code>, run{" "}
        <code className="text-zinc-400">rm -rf .next</code>, then <code className="text-zinc-400">npm run dev</code> again
        (dev + build must not run at the same time).
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-full bg-white px-5 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-200"
        >
          Try again
        </button>
        <Link href="/" className="text-sm text-zinc-400 underline-offset-4 hover:text-white hover:underline">
          ← Scoreboard
        </Link>
      </div>
    </div>
  );
}
