"use client";

import { useRouter } from "next/navigation";
import { Area, AreaChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import type { GameJoinRow, GamePlayerStatJoin, PlayerSeasonAverageRow, TeamRow } from "@/lib/player/loadPlayerProfile";
import { opponentName, resultWL } from "@/lib/player/loadPlayerProfile";
import { pct } from "@/lib/player/season";

type RowWithGame = GamePlayerStatJoin & { game: GameJoinRow };

export type PlayerProfileClientProps = {
  team: TeamRow | null;
  seasonLabel: string;
  seasonAverages: PlayerSeasonAverageRow | null;
  lastTenChronological: RowWithGame[];
  gameLog: RowWithGame[];
  shootingTotals: {
    fgMade: number;
    fgAtt: number;
    thMade: number;
    thAtt: number;
    ftMade: number;
    ftAtt: number;
  };
  referencePpg: number | null;
};

function toSparkData(values: number[]): { i: number; v: number }[] {
  return values.map((v, i) => ({ i, v }));
}

function MiniSpark({ data, stroke }: { data: { i: number; v: number }[]; stroke: string }) {
  if (data.length === 0) {
    return <div className="flex h-12 items-center justify-center text-xs text-zinc-600">No games yet</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={48}>
      <AreaChart data={data} margin={{ top: 4, right: 2, left: 2, bottom: 0 }}>
        <Area
          type="monotone"
          dataKey="v"
          stroke={stroke}
          fill={stroke}
          fillOpacity={0.15}
          strokeWidth={2}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function SplitDonut({
  made,
  attempted,
  label,
}: {
  made: number;
  attempted: number;
  label: string;
}) {
  const missed = Math.max(0, attempted - made);
  const pctVal = attempted > 0 ? (made / attempted) * 100 : null;
  const data =
    attempted <= 0
      ? [{ name: "Empty", value: 1, fill: "#3f3f46" }]
      : [
          { name: "Made", value: made, fill: "#34d399" },
          { name: "Missed", value: missed, fill: "#27272a" },
        ];

  return (
    <div className="flex flex-1 flex-col items-center rounded-xl border border-zinc-800 bg-zinc-900/40 px-3 py-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
      <div className="relative h-[180px] w-full max-w-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              formatter={(value: number, name: string) => [`${value}`, name]}
              contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }}
            />
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={58}
              outerRadius={82}
              paddingAngle={attempted > 0 ? 1 : 0}
              stroke="none"
              isAnimationActive={false}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold tabular-nums text-white">
            {pctVal != null ? `${pctVal.toFixed(1)}%` : "—"}
          </span>
        </div>
      </div>
      <p className="mt-2 text-center text-sm text-zinc-400">
        <span className="font-mono text-zinc-200">{made}</span>
        <span className="text-zinc-600"> / </span>
        <span className="font-mono text-zinc-200">{attempted}</span>
      </p>
    </div>
  );
}

type SparkKey = "ppg" | "rpg" | "apg" | "spg" | "bpg" | "fgPct" | "tpPct" | "ftPct";

const SPARK_META: {
  key: SparkKey;
  label: string;
  stroke: string;
  seasonPick: (s: PlayerSeasonAverageRow) => number | null | undefined;
  fromRow: (r: RowWithGame) => number;
}[] = [
  { key: "ppg", label: "PPG", stroke: "#fbbf24", seasonPick: (s) => s.ppg, fromRow: (r) => r.points ?? 0 },
  { key: "rpg", label: "RPG", stroke: "#38bdf8", seasonPick: (s) => s.rpg, fromRow: (r) => r.rebounds ?? 0 },
  { key: "apg", label: "APG", stroke: "#a78bfa", seasonPick: (s) => s.apg, fromRow: (r) => r.assists ?? 0 },
  { key: "spg", label: "SPG", stroke: "#fb7185", seasonPick: (s) => s.spg, fromRow: (r) => r.steals ?? 0 },
  { key: "bpg", label: "BPG", stroke: "#2dd4bf", seasonPick: (s) => s.bpg, fromRow: (r) => r.blocks ?? 0 },
  {
    key: "fgPct",
    label: "FG%",
    stroke: "#4ade80",
    seasonPick: (s) => s.fg_pct,
    fromRow: (r) => pct(r.fg_made, r.fg_attempted) ?? 0,
  },
  {
    key: "tpPct",
    label: "3P%",
    stroke: "#60a5fa",
    seasonPick: (s) => s.three_pct,
    fromRow: (r) => pct(r.three_made, r.three_attempted) ?? 0,
  },
  {
    key: "ftPct",
    label: "FT%",
    stroke: "#f472b6",
    seasonPick: (s) => s.ft_pct,
    fromRow: (r) => pct(r.ft_made, r.ft_attempted) ?? 0,
  },
];

function formatGameDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function PlayerProfileClient({
  team,
  seasonLabel,
  seasonAverages,
  lastTenChronological,
  gameLog,
  shootingTotals,
  referencePpg,
}: PlayerProfileClientProps) {
  const router = useRouter();
  const teamName = team?.name ?? "";

  return (
    <div className="mx-auto max-w-6xl space-y-12 px-4 py-10">
      <section aria-labelledby="season-trends-heading">
        <h2 id="season-trends-heading" className="text-lg font-semibold text-white">
          Season trends <span className="text-sm font-normal text-zinc-500">(last 10 games)</span>
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {SPARK_META.map((m) => {
            const series = lastTenChronological.map(m.fromRow);
            const seasonVal = seasonAverages ? m.seasonPick(seasonAverages) : null;
            const fallback = series.length ? series.reduce((a, b) => a + b, 0) / series.length : null;
            const display =
              seasonVal != null && !Number.isNaN(Number(seasonVal))
                ? Number(seasonVal)
                : fallback != null
                  ? fallback
                  : null;
            const isPct = m.key === "fgPct" || m.key === "tpPct" || m.key === "ftPct";
            return (
              <div
                key={m.key}
                className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 shadow-sm"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">{m.label}</span>
                  <span className="text-lg font-bold tabular-nums text-white">
                    {display == null ? "—" : isPct ? `${display.toFixed(1)}%` : display.toFixed(1)}
                  </span>
                </div>
                <MiniSpark data={toSparkData(series)} stroke={m.stroke} />
              </div>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="game-log-heading">
        <h2 id="game-log-heading" className="text-lg font-semibold text-white">
          Game log <span className="text-sm font-normal text-zinc-500">({seasonLabel})</span>
        </h2>
        <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full min-w-[960px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/80 text-xs uppercase tracking-wide text-zinc-500">
                <th className="px-3 py-3 font-medium">Date</th>
                <th className="px-3 py-3 font-medium">Opp</th>
                <th className="px-3 py-3 font-medium">Rslt</th>
                <th className="px-3 py-3 font-medium">MIN</th>
                <th className="px-3 py-3 font-medium">PTS</th>
                <th className="px-3 py-3 font-medium">REB</th>
                <th className="px-3 py-3 font-medium">AST</th>
                <th className="px-3 py-3 font-medium">STL</th>
                <th className="px-3 py-3 font-medium">BLK</th>
                <th className="px-3 py-3 font-medium">TO</th>
                <th className="px-3 py-3 font-medium">FG</th>
                <th className="px-3 py-3 font-medium">3PT</th>
                <th className="px-3 py-3 font-medium">FT</th>
                <th className="px-3 py-3 font-medium">+/-</th>
              </tr>
            </thead>
            <tbody>
              {gameLog.length === 0 ? (
                <tr>
                  <td colSpan={14} className="px-4 py-10 text-center text-zinc-500">
                    No games in this season window yet.
                  </td>
                </tr>
              ) : (
                gameLog.map((r) => {
                  const g = r.game;
                  const opp = teamName ? opponentName(g, teamName) : "—";
                  const res = teamName ? resultWL(g, teamName) : "—";
                  const pts = r.points ?? 0;
                  const heat =
                    referencePpg != null
                      ? pts > referencePpg
                        ? "text-emerald-400"
                        : pts < referencePpg
                          ? "text-red-400"
                          : "text-zinc-200"
                      : "text-zinc-200";
                  return (
                    <tr
                      key={r.id}
                      role="link"
                      tabIndex={0}
                      onClick={() => router.push(`/game/${g.external_id}`)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          router.push(`/game/${g.external_id}`);
                        }
                      }}
                      className="cursor-pointer border-b border-zinc-800/80 transition hover:bg-zinc-800/50"
                    >
                      <td className="whitespace-nowrap px-3 py-2.5 text-zinc-300">{formatGameDate(g.start_time)}</td>
                      <td className="max-w-[10rem] truncate px-3 py-2.5 text-zinc-200">{opp}</td>
                      <td className="px-3 py-2.5 font-semibold tabular-nums text-zinc-200">{res}</td>
                      <td className="px-3 py-2.5 font-mono text-zinc-400">{r.minutes ?? "—"}</td>
                      <td className={`px-3 py-2.5 font-mono font-semibold tabular-nums ${heat}`}>{pts}</td>
                      <td className="px-3 py-2.5 font-mono text-zinc-300">{r.rebounds ?? "—"}</td>
                      <td className="px-3 py-2.5 font-mono text-zinc-300">{r.assists ?? "—"}</td>
                      <td className="px-3 py-2.5 font-mono text-zinc-300">{r.steals ?? "—"}</td>
                      <td className="px-3 py-2.5 font-mono text-zinc-300">{r.blocks ?? "—"}</td>
                      <td className="px-3 py-2.5 font-mono text-zinc-300">{r.turnovers ?? "—"}</td>
                      <td className="px-3 py-2.5 font-mono text-zinc-400">
                        {(r.fg_made ?? 0)}-{(r.fg_attempted ?? 0)}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-zinc-400">
                        {(r.three_made ?? 0)}-{(r.three_attempted ?? 0)}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-zinc-400">
                        {(r.ft_made ?? 0)}-{(r.ft_attempted ?? 0)}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-zinc-300">{r.plus_minus ?? "—"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="shooting-heading">
        <h2 id="shooting-heading" className="text-lg font-semibold text-white">
          Shooting splits <span className="text-sm font-normal text-zinc-500">(season)</span>
        </h2>
        <div className="mt-4 flex flex-col gap-6 sm:flex-row sm:items-stretch sm:justify-center">
          <SplitDonut made={shootingTotals.fgMade} attempted={shootingTotals.fgAtt} label="FG%" />
          <SplitDonut made={shootingTotals.thMade} attempted={shootingTotals.thAtt} label="3P%" />
          <SplitDonut made={shootingTotals.ftMade} attempted={shootingTotals.ftAtt} label="FT%" />
        </div>
      </section>
    </div>
  );
}
