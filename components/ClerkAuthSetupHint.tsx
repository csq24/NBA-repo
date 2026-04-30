import Link from "next/link";

type ClerkAuthSetupHintProps = {
  title: string;
};

export function ClerkAuthSetupHint({ title }: ClerkAuthSetupHintProps) {
  return (
    <div className="mx-auto max-w-md rounded-xl border border-zinc-800 bg-zinc-900/50 px-6 py-10 text-center">
      <h1 className="text-lg font-semibold text-white">{title}</h1>
      <p className="mt-3 text-sm text-zinc-400">
        Add <code className="text-zinc-300">NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code> and{" "}
        <code className="text-zinc-300">CLERK_SECRET_KEY</code> from the{" "}
        <a
          href="https://dashboard.clerk.com"
          className="text-amber-200 underline underline-offset-2"
          target="_blank"
          rel="noreferrer"
        >
          Clerk dashboard
        </a>{" "}
        to <code className="text-zinc-300">.env.local</code>, then restart <code className="text-zinc-300">npm run dev</code>.
      </p>
      <p className="mt-4 text-xs text-zinc-500">
        See <code className="text-zinc-400">.env.example</code> for the full list of variables.
      </p>
      <Link href="/" className="mt-8 inline-block text-sm text-zinc-400 underline hover:text-white">
        ← Back to scoreboard
      </Link>
    </div>
  );
}
