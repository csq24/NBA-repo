import Link from "next/link";

export default function GameNotFound() {
  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-20 text-center text-zinc-300">
      <h1 className="text-xl font-semibold text-white">Game not found</h1>
      <p className="mt-2 text-sm text-zinc-500">
        No row in Supabase <code className="text-zinc-400">games</code> for this link (by internal id or ESPN{" "}
        <code className="text-zinc-400">external_id</code>).
      </p>
      <ul className="mx-auto mt-6 max-w-md list-disc space-y-2 pl-5 text-left text-sm text-zinc-400">
        <li>
          Open the scoreboard first so games can upsert from ESPN. If the server logs show upsert errors, run the SQL in{" "}
          <code className="text-zinc-500">supabase/migrations/</code> (in order) in the Supabase SQL Editor.
        </li>
        <li>If you changed projects or wiped the database, reload the home page after migrations.</li>
      </ul>
      <Link href="/" className="mt-8 inline-block text-sm text-amber-200 underline">
        ← Back to scoreboard
      </Link>
    </div>
  );
}
