"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const message =
    error && typeof error === "object" && "message" in error && typeof (error as Error).message === "string"
      ? (error as Error).message
      : "Something went wrong";

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-zinc-950 px-4 py-16 text-center text-zinc-100">
      <h1 className="text-lg font-semibold text-white">Something went wrong</h1>
      <p className="mt-2 max-w-md text-sm text-zinc-400">{message}</p>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-8 rounded-full bg-white px-5 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-200"
      >
        Try again
      </button>
    </div>
  );
}
