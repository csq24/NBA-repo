import Link from "next/link";

export default function TeamNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 text-center text-zinc-300">
      <h1 className="text-xl font-semibold text-white">Team not found</h1>
      <p className="mt-2 max-w-md text-sm text-zinc-500">
        Use a team UUID from your Supabase <code className="text-zinc-400">teams</code> table in the URL.
      </p>
      <Link href="/" className="mt-8 text-sm font-medium text-amber-200 underline underline-offset-4">
        ← Back to scoreboard
      </Link>
    </div>
  );
}
