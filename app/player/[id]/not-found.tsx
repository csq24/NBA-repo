import Link from "next/link";

export default function PlayerNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 text-center text-zinc-300">
      <h1 className="text-xl font-semibold text-white">Player not found</h1>
      <p className="mt-2 max-w-md text-sm text-zinc-500">
        No player matches this id. Use a Supabase player UUID or ESPN athlete id from the URL.
      </p>
      <Link href="/" className="mt-8 text-sm font-medium text-amber-200 underline underline-offset-4">
        ← Back to scoreboard
      </Link>
    </div>
  );
}
