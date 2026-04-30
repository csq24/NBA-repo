"use client";

import { useCallback, useEffect, useState } from "react";

import { fetchMatchStatsBundle } from "@/app/actions/matchStats";
import type { MatchPlayerStatRow, MatchStatsBundle, TeamAggregate } from "@/lib/match-stats/types";

type TabId = "players" | "teams";

function sideLabel(
  row: MatchPlayerStatRow,
  match: NonNullable<MatchStatsBundle["match"]>,
  homeLabel: string,
  awayLabel: string,
): string {
  if (row.team_id === match.home_team_id) return homeLabel;
  if (row.team_id === match.away_team_id) return awayLabel;
  return "—";
}

function TeamAggregateCard({
  title,
  agg,
  noTeamHint,
}: {
  title: string;
  agg: TeamAggregate | null;
  noTeamHint: string;
}) {
  if (!agg) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
        <h3 className="text-sm font-semibold text-zinc-200">{title}</h3>
        <p className="mt-3 text-sm text-zinc-500">{noTeamHint}</p>
      </div>
    );
  }

  const rows: { k: string; v: string }[] = [
    { k: "Record (W-D-L)", v: `${agg.wins}-${agg.draws}-${agg.losses}` },
    { k: "Goals for", v: String(agg.goals_for) },
    { k: "Goals against", v: String(agg.goals_against) },
    { k: "Goal difference", v: agg.goal_difference >= 0 ? `+${agg.goal_difference}` : String(agg.goal_difference) },
    { k: "Clean sheets", v: String(agg.clean_sheets) },
    {
      k: "Top scorer",
      v: agg.top_scorer_name ? `${agg.top_scorer_name} (${agg.top_scorer_goals})` : "—",
    },
    {
      k: "Top assister",
      v: agg.top_assister_name ? `${agg.top_assister_name} (${agg.top_assister_assists})` : "—",
    },
  ];

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40">
      <div className="border-b border-zinc-800 px-4 py-3">
        <h3 className="text-sm font-semibold text-white">{agg.team_name}</h3>
        <p className="mt-0.5 text-xs text-zinc-500">{title} · all matches in database</p>
      </div>
      <dl className="divide-y divide-zinc-800/80 px-4 py-2">
        {rows.map((r) => (
          <div key={r.k} className="flex items-center justify-between gap-4 py-2.5 text-sm">
            <dt className="text-zinc-400">{r.k}</dt>
            <dd className="shrink-0 tabular-nums text-right font-medium text-zinc-100">{r.v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function MatchStatsTabs({ gameId, initial }: { gameId: string; initial: MatchStatsBundle }) {
  const [bundle, setBundle] = useState<MatchStatsBundle>(initial);
  const [tab, setTab] = useState<TabId>("players");

  const refresh = useCallback(async () => {
    const next = await fetchMatchStatsBundle(gameId);
    if (next) {
      setBundle(next);
    }
  }, [gameId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const id = setInterval(() => {
      void refresh();
    }, 90_000);
    return () => clearInterval(id);
  }, [refresh]);

  const { match, players, homeAggregate, awayAggregate, homeLabel, awayLabel } = bundle;
  const scoreLine =
    match != null ? `${homeLabel} ${match.home_score} — ${match.away_score} ${awayLabel}` : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Match statistics</h2>
          <p className="text-sm text-zinc-500">
            Per-player lines for this match and team totals aggregated across every linked match in Supabase.
          </p>
        </div>
        {scoreLine ? (
          <span className="inline-flex w-fit rounded-full bg-zinc-800 px-3 py-1 text-xs font-medium text-zinc-200 ring-1 ring-zinc-700">
            {scoreLine}
          </span>
        ) : null}
      </div>

      {!match ? (
        <p className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-5 text-sm text-zinc-400">
          No <code className="text-zinc-500">matches</code> row is linked to this game yet — this block is for optional
          soccer-style match rows (<code className="text-zinc-500">match_player_stats</code>). NBA player/team lines use the{" "}
          <strong className="text-zinc-300">Box score</strong> section above after{" "}
          <code className="text-zinc-500">/api/sync-boxscore</code> has run. To populate this tab, insert a{" "}
          <code className="text-zinc-500">matches</code> row with <code className="text-zinc-500">game_id</code> set to this
          game&apos;s id (see migration <code className="text-zinc-500">008_match_soccer_stats.sql</code>).
        </p>
      ) : null}

      <div className="flex gap-1 rounded-lg border border-zinc-800 bg-zinc-900/50 p-1">
        {(
          [
            { id: "players" as const, label: "Player stats" },
            { id: "teams" as const, label: "Team stats" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.id ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "players" ? (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40">
          <div className="border-b border-zinc-800 px-4 py-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-300">This match</h3>
            <p className="mt-1 text-xs text-zinc-500">Goals, assists, discipline, minutes, and position.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500">
                  <th className="px-3 py-2 font-medium">Side</th>
                  <th className="px-3 py-2 font-medium">Player</th>
                  <th className="px-3 py-2 font-medium">Pos</th>
                  <th className="px-3 py-2 text-right font-medium tabular-nums">G</th>
                  <th className="px-3 py-2 text-right font-medium tabular-nums">A</th>
                  <th className="px-3 py-2 text-right font-medium tabular-nums">YC</th>
                  <th className="px-3 py-2 text-right font-medium tabular-nums">RC</th>
                  <th className="px-3 py-2 text-right font-medium tabular-nums">Min</th>
                </tr>
              </thead>
              <tbody>
                {!match ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-zinc-500">
                      Link a match to load player lines.
                    </td>
                  </tr>
                ) : players.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-zinc-500">
                      No rows in <code className="text-zinc-600">match_player_stats</code> for this match yet.
                    </td>
                  </tr>
                ) : (
                  players.map((row) => (
                    <tr key={row.player_id} className="border-b border-zinc-800/60 last:border-0">
                      <td className="px-3 py-2 text-zinc-400">{sideLabel(row, match, homeLabel, awayLabel)}</td>
                      <td className="px-3 py-2 font-medium text-zinc-100">{row.player_name}</td>
                      <td className="px-3 py-2 text-zinc-400">{row.position ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-zinc-200">{row.goals}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-zinc-200">{row.assists}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-zinc-200">{row.yellow_cards}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-zinc-200">{row.red_cards}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-zinc-200">{row.minutes_played}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : !match ? (
        <p className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-8 text-center text-sm text-zinc-500">
          Team aggregates need a linked <code className="text-zinc-600">matches</code> row with home and away team ids.
        </p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <TeamAggregateCard
            title="Home"
            agg={homeAggregate}
            noTeamHint={`Set home_team_id on the match row to aggregate season stats for ${homeLabel}.`}
          />
          <TeamAggregateCard
            title="Away"
            agg={awayAggregate}
            noTeamHint={`Set away_team_id on the match row to aggregate season stats for ${awayLabel}.`}
          />
        </div>
      )}
    </div>
  );
}
