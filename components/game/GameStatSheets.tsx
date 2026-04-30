"use client";

import Link from "next/link";
import { useState } from "react";

import type { GameBoxscoreSnapshot, GameTeamStatsRow } from "@/lib/game/types";

/** ESPN/CDN URLs vary; avoid `next/image` domain errors that crash the game page. */
function PlayerAvatar({ name, headshotUrl }: { name: string; headshotUrl: string | null }) {
  const [failed, setFailed] = useState(false);
  if (!headshotUrl || failed) {
    return (
      <span className="flex h-full w-full items-center justify-center text-[10px] text-zinc-500">
        {name.slice(0, 1)}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- intentional: arbitrary ESPN hostnames
    <img
      src={headshotUrl}
      alt=""
      className="h-full w-full object-cover"
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

function fmtInt(n: number | null | undefined): string {
  if (n == null) return "—";
  return String(n);
}

function fmtPm(n: number | null | undefined): string {
  if (n == null) return "—";
  return n > 0 ? `+${n}` : String(n);
}

function fmtRateFromMilli(n: number | null | undefined): string {
  if (n == null) return "—";
  return (n / 1000).toFixed(3);
}

/** Shots missed = attempts − made when both are known. */
function fmtMiss(made: number | null | undefined, att: number | null | undefined): string {
  if (made == null || att == null) return "—";
  const miss = att - made;
  return miss < 0 ? "—" : String(miss);
}

function TeamTotalsTable({
  label,
  home,
  away,
  league,
}: {
  label: string;
  home: GameTeamStatsRow | null;
  away: GameTeamStatsRow | null;
  league: string;
}) {
  const rows: { k: string; h: string; a: string }[] =
    league === "nhl"
      ? [
          { k: "Goals", h: fmtInt(home?.points), a: fmtInt(away?.points) },
          { k: "Shots", h: fmtInt(home?.fg_made), a: fmtInt(away?.fg_made) },
          { k: "Hits", h: fmtInt(home?.fg_attempted), a: fmtInt(away?.fg_attempted) },
          { k: "Takeaways", h: fmtInt(home?.three_made), a: fmtInt(away?.three_made) },
          { k: "Giveaways", h: fmtInt(home?.three_attempted), a: fmtInt(away?.three_attempted) },
          { k: "PPG", h: fmtInt(home?.ft_made), a: fmtInt(away?.ft_made) },
          { k: "PPO", h: fmtInt(home?.ft_attempted), a: fmtInt(away?.ft_attempted) },
          { k: "Faceoffs Won", h: fmtInt(home?.offensive_rebounds), a: fmtInt(away?.offensive_rebounds) },
          { k: "Blocks", h: fmtInt(home?.assists), a: fmtInt(away?.assists) },
          { k: "PIM", h: fmtInt(home?.total_rebounds), a: fmtInt(away?.total_rebounds) },
          { k: "FO%", h: fmtInt(home?.turnovers), a: fmtInt(away?.turnovers) },
        ]
      : league === "mlb"
        ? [
            { k: "R", h: fmtInt(home?.assists), a: fmtInt(away?.assists) },
            { k: "H", h: fmtInt(home?.fg_made), a: fmtInt(away?.fg_made) },
            { k: "AB", h: fmtInt(home?.fg_attempted), a: fmtInt(away?.fg_attempted) },
            { k: "RBI", h: fmtInt(home?.points), a: fmtInt(away?.points) },
            { k: "HR", h: fmtInt(home?.three_made), a: fmtInt(away?.three_made) },
            { k: "BB", h: fmtInt(home?.turnovers), a: fmtInt(away?.turnovers) },
            { k: "K", h: fmtInt(home?.blocks), a: fmtInt(away?.blocks) },
            {
              k: "AVG",
              h:
                home?.fg_made != null && home?.fg_attempted
                  ? (home.fg_made / home.fg_attempted).toFixed(3)
                  : "—",
              a:
                away?.fg_made != null && away?.fg_attempted
                  ? (away.fg_made / away.fg_attempted).toFixed(3)
                  : "—",
            },
            {
              k: "OBP",
              h:
                home?.fg_made != null && home?.fg_attempted != null && home?.turnovers != null
                  ? ((home.fg_made + home.turnovers) / Math.max(1, home.fg_attempted + home.turnovers)).toFixed(3)
                  : "—",
              a:
                away?.fg_made != null && away?.fg_attempted != null && away?.turnovers != null
                  ? ((away.fg_made + away.turnovers) / Math.max(1, away.fg_attempted + away.turnovers)).toFixed(3)
                  : "—",
            },
            { k: "SLG", h: "—", a: "—" },
          ]
        : [
          { k: "PTS", h: fmtInt(home?.points), a: fmtInt(away?.points) },
          { k: "FGM", h: fmtInt(home?.fg_made), a: fmtInt(away?.fg_made) },
          { k: "FGA", h: fmtInt(home?.fg_attempted), a: fmtInt(away?.fg_attempted) },
          { k: "FG missed", h: fmtMiss(home?.fg_made, home?.fg_attempted), a: fmtMiss(away?.fg_made, away?.fg_attempted) },
          { k: "3PM", h: fmtInt(home?.three_made), a: fmtInt(away?.three_made) },
          { k: "3PA", h: fmtInt(home?.three_attempted), a: fmtInt(away?.three_attempted) },
          { k: "3PT missed", h: fmtMiss(home?.three_made, home?.three_attempted), a: fmtMiss(away?.three_made, away?.three_attempted) },
          { k: "FTM", h: fmtInt(home?.ft_made), a: fmtInt(away?.ft_made) },
          { k: "FTA", h: fmtInt(home?.ft_attempted), a: fmtInt(away?.ft_attempted) },
          { k: "FT missed", h: fmtMiss(home?.ft_made, home?.ft_attempted), a: fmtMiss(away?.ft_made, away?.ft_attempted) },
          { k: "REB", h: fmtInt(home?.total_rebounds), a: fmtInt(away?.total_rebounds) },
          { k: "OREB", h: fmtInt(home?.offensive_rebounds), a: fmtInt(away?.offensive_rebounds) },
          { k: "DREB", h: fmtInt(home?.defensive_rebounds), a: fmtInt(away?.defensive_rebounds) },
          { k: "AST", h: fmtInt(home?.assists), a: fmtInt(away?.assists) },
          { k: "STL", h: fmtInt(home?.steals), a: fmtInt(away?.steals) },
          { k: "BLK", h: fmtInt(home?.blocks), a: fmtInt(away?.blocks) },
          { k: "TO", h: fmtInt(home?.turnovers), a: fmtInt(away?.turnovers) },
          { k: "FB PTS", h: fmtInt(home?.fast_break_points), a: fmtInt(away?.fast_break_points) },
          { k: "PAINT", h: fmtInt(home?.points_in_paint), a: fmtInt(away?.points_in_paint) },
        ];

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40">
      <div className="border-b border-zinc-800 px-4 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-300">{label}</h2>
        <p className="mt-1 text-xs text-zinc-500">
          {league === "nhl"
            ? "Team totals from the synced NHL box score (goals, shots, hits, special teams, and faceoff metrics)."
            : league === "mlb"
              ? "Team batting totals from ESPN MLB box score (AB, R, H, RBI, HR, BB, K, AVG, OBP, SLG)."
            : "Team totals from the synced box score. Shooting shows makes, attempts, and misses (ESPN box score)."}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[320px] text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500">
              <th className="px-4 py-2 font-medium">Stat</th>
              <th className="px-4 py-2 text-right font-medium tabular-nums">Home</th>
              <th className="px-4 py-2 text-right font-medium tabular-nums">Away</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.k} className="border-b border-zinc-800/80 last:border-0">
                <td className="px-4 py-2 text-zinc-400">{r.k}</td>
                <td className="px-4 py-2 text-right tabular-nums text-zinc-100">{r.h}</td>
                <td className="px-4 py-2 text-right tabular-nums text-zinc-100">{r.a}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PlayerTable({
  title,
  lines,
  scheduledPregame,
  league,
}: {
  title: string;
  lines: GameBoxscoreSnapshot["homePlayers"];
  scheduledPregame?: boolean;
  league: string;
}) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40">
      <div className="border-b border-zinc-800 px-4 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-300">{title}</h2>
        <p className="mt-1 text-xs text-zinc-500">
          {lines.length} players ·{" "}
          {scheduledPregame
            ? "pregame roster from ESPN · all stats 0 until the box score sync runs after tipoff"
            : league === "nhl"
              ? "NHL box score from ESPN · goals, assists, TOI, shots, hits, takeaways/giveaways"
              : league === "mlb"
                ? "MLB batting lines from ESPN · AB, R, H, RBI, HR, BB, K, AVG, OBP, SLG"
              : "FGA / misses from ESPN box score · click a name for season profile"}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500">
              <th className="w-8 px-2 py-2 font-medium" />
              <th className="px-2 py-2 font-medium">#</th>
              <th className="min-w-[160px] px-2 py-2 font-medium">Player</th>
              <th className="px-2 py-2 text-right font-medium">{league === "nhl" ? "TOI" : league === "mlb" ? "AB" : "MIN"}</th>
              <th className="px-2 py-2 text-right font-medium">{league === "mlb" ? "R" : "PTS"}</th>
              <th className="border-l border-zinc-800/80 px-2 py-2 text-right font-medium">{league === "mlb" ? "H" : "FGA"}</th>
              <th className="px-2 py-2 text-right font-medium">{league === "nhl" ? "G" : league === "mlb" ? "RBI" : "FGM"}</th>
              <th className="px-2 py-2 text-right font-medium">{league === "nhl" ? "Hits" : league === "mlb" ? "HR" : "FG miss"}</th>
              <th className="px-2 py-2 text-right font-medium">{league === "nhl" ? "FOW" : league === "mlb" ? "BB" : "3PA"}</th>
              <th className="px-2 py-2 text-right font-medium">{league === "nhl" ? "Takeaways" : league === "mlb" ? "K" : "3PM"}</th>
              <th className="px-2 py-2 text-right font-medium">{league === "nhl" ? "Giveaways" : league === "mlb" ? "AVG" : "3P miss"}</th>
              <th className="px-2 py-2 text-right font-medium">{league === "nhl" ? "Shifts" : league === "mlb" ? "OBP" : "FTA"}</th>
              <th className="px-2 py-2 text-right font-medium">{league === "nhl" ? "Pen" : league === "mlb" ? "SLG" : "FTM"}</th>
              <th className="px-2 py-2 text-right font-medium">{league === "nhl" ? "PIM" : league === "mlb" ? "" : "FT miss"}</th>
              <th className="border-l border-zinc-800/80 px-2 py-2 text-right font-medium">{league === "nhl" ? "SOG" : league === "mlb" ? "" : "REB"}</th>
              <th className="px-2 py-2 text-right font-medium">{league === "mlb" ? "" : "AST"}</th>
              <th className="px-2 py-2 text-right font-medium">{league === "nhl" ? "TK" : league === "mlb" ? "" : "STL"}</th>
              <th className="px-2 py-2 text-right font-medium">{league === "mlb" ? "" : "BLK"}</th>
              <th className="px-2 py-2 text-right font-medium">{league === "nhl" ? "GV" : league === "mlb" ? "" : "TO"}</th>
              <th className="px-2 py-2 text-right font-medium">{league === "nhl" ? "PIM" : league === "mlb" ? "" : "PF"}</th>
              <th className="px-2 py-2 text-right font-medium">{league === "mlb" ? "" : "+/-"}</th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr>
                <td colSpan={21} className="px-4 py-8 text-center text-zinc-500">
                  No player lines yet for this side.
                </td>
              </tr>
            ) : (
              lines.map(({ player, stats }) => (
                <tr
                  key={player.id}
                  className={`border-b border-zinc-800/60 last:border-0 ${scheduledPregame ? "bg-black/45" : ""}`}
                >
                  <td className="px-2 py-2 text-center text-xs text-amber-400/90">{stats.starter ? "★" : ""}</td>
                  <td className="px-2 py-2 tabular-nums text-zinc-500">{player.jersey_number ?? "—"}</td>
                  <td className="px-2 py-2">
                    <Link
                      href={`/player/${player.id}`}
                      className="group flex items-center gap-2 font-medium text-zinc-100 hover:text-amber-200"
                    >
                      <span className="relative flex h-8 w-8 shrink-0 overflow-hidden rounded-full bg-zinc-800">
                        <PlayerAvatar name={player.name} headshotUrl={player.headshot_url} />
                      </span>
                      <span className="min-w-0 truncate underline-offset-2 group-hover:underline">{player.name}</span>
                    </Link>
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-zinc-300">{league === "mlb" ? fmtInt(stats.fg_attempted) : (stats.minutes ?? "—")}</td>
                  <td className="px-2 py-2 text-right tabular-nums font-medium text-white">{league === "mlb" ? fmtInt(stats.assists) : fmtInt(stats.points)}</td>
                  <td className="border-l border-zinc-800/60 px-2 py-2 text-right tabular-nums text-zinc-300">
                    {league === "mlb" ? fmtInt(stats.fg_made) : fmtInt(stats.fg_attempted)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-zinc-300">{league === "mlb" ? fmtInt(stats.points) : fmtInt(stats.fg_made)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-zinc-300">{league === "mlb" ? fmtInt(stats.three_made) : league === "nhl" ? fmtInt(stats.three_made) : fmtMiss(stats.fg_made, stats.fg_attempted)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-zinc-300">{league === "mlb" ? fmtInt(stats.turnovers) : fmtInt(stats.three_attempted)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-zinc-300">{league === "mlb" ? fmtInt(stats.blocks) : league === "nhl" ? fmtInt(stats.steals) : fmtInt(stats.three_made)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-zinc-300">{league === "mlb" ? fmtRateFromMilli(stats.plus_minus) : league === "nhl" ? fmtInt(stats.turnovers) : fmtMiss(stats.three_made, stats.three_attempted)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-zinc-300">{league === "mlb" ? fmtRateFromMilli(stats.steals) : fmtInt(stats.ft_attempted)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-zinc-300">{league === "mlb" ? fmtRateFromMilli(stats.fouls) : fmtInt(stats.ft_made)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-zinc-300">{league === "mlb" ? "—" : league === "nhl" ? fmtInt(stats.fouls) : fmtMiss(stats.ft_made, stats.ft_attempted)}</td>
                  <td className="border-l border-zinc-800/60 px-2 py-2 text-right tabular-nums text-zinc-300">{league === "mlb" ? "—" : fmtInt(stats.rebounds)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-zinc-300">{league === "mlb" ? "—" : fmtInt(stats.assists)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-zinc-300">{league === "mlb" ? "—" : fmtInt(stats.steals)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-zinc-300">{league === "mlb" ? "—" : fmtInt(stats.blocks)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-zinc-300">{league === "mlb" ? "—" : fmtInt(stats.turnovers)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-zinc-300">{league === "mlb" ? "—" : fmtInt(stats.fouls)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-zinc-300">{league === "mlb" ? "—" : fmtPm(stats.plus_minus)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

type GameStatSheetsProps = {
  snapshot: GameBoxscoreSnapshot | null;
};

export function GameStatSheets({ snapshot }: GameStatSheetsProps) {
  if (!snapshot) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <p className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-6 text-center text-sm text-zinc-400">
          Could not load the box score snapshot. Refresh the page or check Supabase connectivity.
        </p>
      </div>
    );
  }

  const { home, away, homePlayers, awayPlayers, game } = snapshot;
  const hasTeamLines = Boolean(home?.stats || away?.stats);
  const hasPlayerLines = homePlayers.length > 0 || awayPlayers.length > 0;
  const isLive = game.status === "in_progress";
  const finalPending = game.status === "final" && !game.stats_synced;
  const pregamePreview = game.status === "scheduled" && hasPlayerLines;

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-white">Box score</h2>
            {pregamePreview ? (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-300 ring-1 ring-amber-500/30">
                Pregame preview (zeros)
              </span>
            ) : null}
          </div>
          <p className="text-sm text-zinc-500">
            {pregamePreview
              ? "Preview roster loaded before tipoff. Player and team lines are placeholders (all zeros) until ESPN publishes the live box score."
              : isLive
              ? "Scores refresh live from the games row; team and player lines update when the box score sync runs."
              : finalPending
                ? "Game is final — waiting for the last full box score sync to mark stats complete."
                : "Full team and player stats for this game."}
          </p>
        </div>
        <span
          className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
            isLive ? "bg-red-500/15 text-red-300 ring-1 ring-red-500/30" : "bg-zinc-800 text-zinc-400 ring-1 ring-zinc-700"
          }`}
        >
          {isLive ? "Live refresh" : "Postgame"}
        </span>
      </div>

      {!hasTeamLines && !hasPlayerLines ? (
        <div className="rounded-xl border border-amber-900/40 bg-amber-950/20 px-4 py-5 text-sm text-amber-100/90">
          <p className="font-medium text-amber-200">No box score rows in the database yet.</p>
          <p className="mt-2 text-amber-100/80">
            Scores on the header come from the <code className="text-xs text-amber-200/90">games</code> row; player and team
            lines are filled by the ESPN box score sync into <code className="text-xs text-amber-200/90">game_team_stats</code>{" "}
            and <code className="text-xs text-amber-200/90">game_player_stats</code>{" "}
            <strong className="text-amber-200">NBA and men&apos;s college basketball only</strong> — other leagues use different ESPN stat shapes.
          </p>
          <p className="mt-2 text-amber-100/80">
            <strong className="text-amber-200">Local dev:</strong> set{" "}
            <code className="rounded bg-black/30 px-1 py-0.5 text-xs text-amber-200">SUPABASE_SERVICE_ROLE_KEY</code> in{" "}
            <code className="text-xs text-amber-200/90">.env.local</code>, restart <code className="text-xs text-amber-200/90">npm run dev</code>, then open{" "}
            <code className="rounded bg-black/30 px-1 py-0.5 text-xs text-amber-200">/api/sync-boxscore</code> on the same host (or cron) or{" "}
            <code className="rounded bg-black/30 px-1 py-0.5 text-xs text-amber-200">curl …/api/sync-boxscore?format=json</code>
            . (If <code className="text-xs text-amber-200/90">CRON_SECRET</code> is unset, auth is skipped in development.) Reload this page after a successful sync.
          </p>
          <p className="mt-2 text-amber-100/80">
            <strong className="text-amber-200">Production:</strong> Vercel Cron calls the same route (see{" "}
            <code className="text-xs text-amber-200/90">vercel.json</code>) with{" "}
            <code className="rounded bg-black/30 px-1 py-0.5 text-xs text-amber-200">Authorization: Bearer CRON_SECRET</code>.
          </p>
        </div>
      ) : null}

      {hasTeamLines ? (
        <TeamTotalsTable
          label="Team comparison"
          home={home?.stats ?? null}
          away={away?.stats ?? null}
          league={game.league}
        />
      ) : null}

      <div className="grid gap-8 lg:grid-cols-2">
        <PlayerTable
          title={`${game.home_team} — players`}
          lines={homePlayers}
          scheduledPregame={game.status === "scheduled"}
          league={game.league}
        />
        <PlayerTable
          title={`${game.away_team} — players`}
          lines={awayPlayers}
          scheduledPregame={game.status === "scheduled"}
          league={game.league}
        />
      </div>
    </div>
  );
}
