import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PlayerProfileClient } from "@/components/player/PlayerProfileClient";
import { loadPlayerProfile } from "@/lib/player/loadPlayerProfile";
import { tryCreateClient } from "@/lib/supabase/server";

type PageProps = {
  params: { id: string };
};

function num(n: unknown): number | null {
  if (n == null || n === "") return null;
  const v = Number(n);
  return Number.isFinite(v) ? v : null;
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-full border border-zinc-700/90 bg-zinc-900/70 px-3 py-2 text-center shadow-sm">
      <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-white">{value}</p>
    </div>
  );
}

function SupabaseHint() {
  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-16 text-center text-zinc-300">
      <p className="text-lg font-medium text-white">Supabase is not configured</p>
      <p className="mt-2 text-sm text-zinc-500">
        Add <code className="text-zinc-400">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
        <code className="text-zinc-400">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to{" "}
        <code className="text-zinc-400">.env.local</code>.
      </p>
      <Link href="/" className="mt-8 inline-block text-sm text-amber-200 underline">
        ← Back to scoreboard
      </Link>
    </div>
  );
}

export async function generateMetadata({ params }: PageProps) {
  const supabase = tryCreateClient();
  if (!supabase) return { title: "Player" };
  const data = await loadPlayerProfile(supabase, params.id);
  return { title: data ? `${data.player.name} · Player` : "Player" };
}

export default async function PlayerPage({ params }: PageProps) {
  const supabase = tryCreateClient();
  if (!supabase) {
    return <SupabaseHint />;
  }

  const data = await loadPlayerProfile(supabase, params.id);
  if (!data) {
    notFound();
  }

  const { player, team, seasonLabel, seasonAverages, lastTenChronological, gameLog, shootingTotals, referencePpg } =
    data;

  const s = seasonAverages;
  const pills: { label: string; value: string }[] = [
    { label: "PPG", value: s?.ppg != null ? num(s.ppg)!.toFixed(1) : "—" },
    { label: "RPG", value: s?.rpg != null ? num(s.rpg)!.toFixed(1) : "—" },
    { label: "APG", value: s?.apg != null ? num(s.apg)!.toFixed(1) : "—" },
    { label: "SPG", value: s?.spg != null ? num(s.spg)!.toFixed(1) : "—" },
    { label: "BPG", value: s?.bpg != null ? num(s.bpg)!.toFixed(1) : "—" },
    { label: "FG%", value: s?.fg_pct != null ? `${num(s.fg_pct)!.toFixed(1)}%` : "—" },
    { label: "3P%", value: s?.three_pct != null ? `${num(s.three_pct)!.toFixed(1)}%` : "—" },
    { label: "FT%", value: s?.ft_pct != null ? `${num(s.ft_pct)!.toFixed(1)}%` : "—" },
  ];

  const jersey = player.jersey_number?.trim();
  const pos = player.position?.trim();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="border-b border-zinc-800 px-4 py-3">
        <Link
          href="/"
          className="text-sm font-medium text-zinc-400 underline-offset-4 hover:text-white hover:underline"
        >
          ← Scoreboard
        </Link>
      </div>

      <header className="border-b border-zinc-800 bg-gradient-to-b from-zinc-900 to-zinc-950 px-4 pb-10 pt-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 lg:flex-row lg:items-center lg:gap-12">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <div className="relative h-32 w-32 shrink-0 overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-800 shadow-lg sm:h-36 sm:w-36">
              {player.headshot_url ? (
                <Image
                  src={player.headshot_url}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="144px"
                  unoptimized
                />
              ) : (
                <div className="flex h-full items-center justify-center text-4xl font-bold text-zinc-600">
                  {player.name.slice(0, 1)}
                </div>
              )}
            </div>
            <div className="text-center sm:text-left">
              <div className="flex flex-wrap items-center justify-center gap-3 sm:justify-start">
                {team?.logo_url ? (
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-zinc-800 ring-1 ring-zinc-700">
                    <Image src={team.logo_url} alt="" fill className="object-contain p-1" sizes="48px" unoptimized />
                  </div>
                ) : null}
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{player.name}</h1>
                  <p className="mt-1 text-sm text-zinc-400">
                    {[pos, jersey ? `#${jersey}` : null, team?.abbreviation ? `· ${team.abbreviation}` : null]
                      .filter(Boolean)
                      .join(" ")}
                  </p>
                  <p className="mt-1 text-xs text-zinc-600">
                    Season {seasonLabel}
                    {s?.games_played != null ? ` · ${s.games_played} GP` : null}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1">
            <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500 lg:text-left">
              Season averages
            </p>
            <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
              {pills.map((p) => (
                <StatPill key={p.label} label={p.label} value={p.value} />
              ))}
            </div>
          </div>
        </div>
      </header>

      <PlayerProfileClient
        team={team}
        seasonLabel={seasonLabel}
        seasonAverages={seasonAverages}
        lastTenChronological={lastTenChronological}
        gameLog={gameLog}
        shootingTotals={shootingTotals}
        referencePpg={referencePpg}
      />
    </div>
  );
}
