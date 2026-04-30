import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { TeamPageClient } from "@/components/team/TeamPageClient";
import type { TeamSeasonStatsRow } from "@/lib/team/loadTeamProfile";
import { loadTeamProfile } from "@/lib/team/loadTeamProfile";
import { tryCreateClient } from "@/lib/supabase/server";

type PageProps = {
  params: { id: string };
};

function num(n: unknown): number | null {
  if (n == null || n === "") return null;
  const v = Number(n);
  return Number.isFinite(v) ? v : null;
}

function fmtStat(n: number | null | undefined, suffix = ""): string {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return `${Number(n).toFixed(1)}${suffix}`;
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-full border border-zinc-700/90 bg-zinc-900/70 px-3 py-2 text-center shadow-sm">
      <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-white">{value}</p>
    </div>
  );
}

function FormStrip({ form }: { form: ("W" | "L")[] }) {
  if (form.length === 0) {
    return (
      <div className="border-b border-zinc-800 bg-zinc-900/30 px-4 py-3">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Last 5</span>
          <span className="text-xs text-zinc-600">No completed games in window.</span>
        </div>
      </div>
    );
  }
  return (
    <div className="border-b border-zinc-800 bg-zinc-900/40 px-4 py-3">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Form (last 5)</span>
        <div className="flex flex-wrap gap-1.5">
          {form.map((b, i) => (
            <span
              key={`${b}-${i}`}
              className={`flex h-8 w-8 items-center justify-center rounded-md text-xs font-bold ${
                b === "W" ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40" : "bg-red-500/20 text-red-300 ring-1 ring-red-500/40"
              }`}
            >
              {b}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function ShootingDashboard({ stats }: { stats: TeamSeasonStatsRow | null }) {
  if (!stats) {
    return (
      <section className="mx-auto max-w-6xl px-4 py-6">
        <h2 className="text-lg font-semibold text-white">Team shooting dashboard</h2>
        <p className="mt-2 text-sm text-zinc-500">No `team_season_stats` row for this season yet.</p>
      </section>
    );
  }

  const rows: { label: string; offense: string; defense: string }[] = [
    { label: "PPG", offense: fmtStat(stats.ppg), defense: fmtStat(stats.opp_ppg) },
    { label: "FG%", offense: fmtStat(stats.fg_pct, "%"), defense: "—" },
    { label: "3P%", offense: fmtStat(stats.three_pct, "%"), defense: "—" },
    { label: "FT%", offense: fmtStat(stats.ft_pct, "%"), defense: "—" },
    { label: "RPG", offense: fmtStat(stats.rpg), defense: "—" },
    { label: "APG", offense: fmtStat(stats.apg), defense: "—" },
    { label: "SPG", offense: fmtStat(stats.spg), defense: fmtStat(stats.spg) },
    { label: "BPG", offense: fmtStat(stats.bpg), defense: fmtStat(stats.bpg) },
    { label: "TOV/G", offense: fmtStat(stats.topg), defense: "—" },
  ];

  return (
    <section className="mx-auto max-w-6xl px-4 py-6" aria-labelledby="shoot-dash-heading">
      <h2 id="shoot-dash-heading" className="text-lg font-semibold text-white">
        Team shooting dashboard
      </h2>
      <p className="mt-1 text-sm text-zinc-500">
        Season totals from <code className="text-zinc-400">team_season_stats</code> — offense vs opponent points and
        per-game stocks.
      </p>
      <div className="mt-4 overflow-hidden rounded-xl border border-zinc-800">
        <div className="grid grid-cols-3 gap-0 bg-zinc-900/50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          <div className="border-b border-zinc-800 px-4 py-3">Stat</div>
          <div className="border-b border-zinc-800 px-4 py-3 text-amber-200/90">Offense</div>
          <div className="border-b border-zinc-800 px-4 py-3 text-sky-200/90">Defense</div>
        </div>
        {rows.map((r) => (
          <div key={r.label} className="grid grid-cols-3 border-b border-zinc-800/80 last:border-b-0">
            <div className="bg-zinc-950/40 px-4 py-3 text-sm font-medium text-zinc-400">{r.label}</div>
            <div className="bg-zinc-900/20 px-4 py-3 font-mono text-sm text-zinc-100">{r.offense}</div>
            <div className="bg-zinc-900/30 px-4 py-3 font-mono text-sm text-zinc-100">{r.defense}</div>
          </div>
        ))}
      </div>
    </section>
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
  if (!supabase) return { title: "Team" };
  const data = await loadTeamProfile(supabase, params.id);
  return { title: data ? `${data.team.name} · Team` : "Team" };
}

export default async function TeamPage({ params }: PageProps) {
  const supabase = tryCreateClient();
  if (!supabase) {
    return <SupabaseHint />;
  }

  const data = await loadTeamProfile(supabase, params.id);
  if (!data) {
    notFound();
  }

  const { team, seasonLabel, seasonStats, roster, gameLog, lastFiveForm, recordDisplay } = data;

  const pills: { label: string; value: string }[] = [
    { label: "PPG", value: seasonStats?.ppg != null ? fmtStat(num(seasonStats.ppg)!) : "—" },
    { label: "Opp PPG", value: seasonStats?.opp_ppg != null ? fmtStat(num(seasonStats.opp_ppg)!) : "—" },
    { label: "FG%", value: seasonStats?.fg_pct != null ? `${num(seasonStats.fg_pct)!.toFixed(1)}%` : "—" },
    { label: "3P%", value: seasonStats?.three_pct != null ? `${num(seasonStats.three_pct)!.toFixed(1)}%` : "—" },
  ];

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

      <FormStrip form={lastFiveForm} />

      <header className="border-b border-zinc-800 bg-gradient-to-b from-zinc-900 to-zinc-950 px-4 pb-10 pt-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
            <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-800 shadow-lg sm:h-28 sm:w-28">
              {team.logo_url ? (
                <Image src={team.logo_url} alt="" fill className="object-contain p-2" sizes="112px" unoptimized />
              ) : (
                <div className="flex h-full items-center justify-center text-2xl font-bold text-zinc-600">
                  {team.abbreviation}
                </div>
              )}
            </div>
            <div className="text-center sm:text-left">
              <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{team.name}</h1>
              <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-300">{recordDisplay}</p>
              <p className="mt-1 text-sm text-zinc-500">
                Season {seasonLabel}
                {seasonStats?.games_played != null ? ` · ${seasonStats.games_played} GP` : null}
                {team.league ? ` · ${team.league.toUpperCase()}` : null}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-2 lg:justify-end">
            {pills.map((p) => (
              <StatPill key={p.label} label={p.label} value={p.value} />
            ))}
          </div>
        </div>
      </header>

      <ShootingDashboard stats={seasonStats} />

      <TeamPageClient teamName={team.name} roster={roster} gameLog={gameLog} />
    </div>
  );
}
