"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import type { GameJoinRow } from "@/lib/player/loadPlayerProfile";
import { pct } from "@/lib/player/season";
import type { GameTeamStatJoin, RosterRow } from "@/lib/team/loadTeamProfile";
import { opponentName, resultWL, scoreDisplay } from "@/lib/team/loadTeamProfile";

type SortKey =
  | "name"
  | "position"
  | "gp"
  | "min"
  | "pts"
  | "reb"
  | "ast"
  | "stl"
  | "blk"
  | "to"
  | "fg"
  | "tp"
  | "ft";

function num(n: unknown): number | null {
  if (n == null || n === "") return null;
  const v = Number(n);
  return Number.isFinite(v) ? v : null;
}

function fmtPctCell(n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return `${Number(n).toFixed(1)}%`;
}

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

function sortValue(row: RosterRow, key: SortKey): string | number | null {
  const a = row.avg;
  switch (key) {
    case "name":
      return row.player.name.toLowerCase();
    case "position":
      return (row.player.position ?? "").toLowerCase();
    case "gp":
      return a?.games_played ?? -1;
    case "min":
      return num(a?.minutes_pg) ?? -1;
    case "pts":
      return num(a?.ppg) ?? -1;
    case "reb":
      return num(a?.rpg) ?? -1;
    case "ast":
      return num(a?.apg) ?? -1;
    case "stl":
      return num(a?.spg) ?? -1;
    case "blk":
      return num(a?.bpg) ?? -1;
    case "to":
      return num(a?.topg) ?? -1;
    case "fg":
      return num(a?.fg_pct) ?? -1;
    case "tp":
      return num(a?.three_pct) ?? -1;
    case "ft":
      return num(a?.ft_pct) ?? -1;
    default:
      return 0;
  }
}

type TeamPageClientProps = {
  teamName: string;
  roster: RosterRow[];
  gameLog: Array<GameTeamStatJoin & { game: GameJoinRow }>;
};

function Th({
  label,
  sortKey,
  active,
  dir,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  active: SortKey;
  dir: "asc" | "desc";
  onSort: (k: SortKey) => void;
}) {
  const isActive = active === sortKey;
  return (
    <th className="whitespace-nowrap px-2 py-3">
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 text-left font-medium uppercase tracking-wide transition hover:text-white ${
          isActive ? "text-amber-200" : "text-zinc-500"
        }`}
      >
        {label}
        {isActive ? <span className="text-[10px] font-normal text-zinc-400">{dir === "asc" ? "↑" : "↓"}</span> : null}
      </button>
    </th>
  );
}

export function TeamPageClient({ teamName, roster, gameLog }: TeamPageClientProps) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<SortKey>("pts");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const onSort = (k: SortKey) => {
    if (k === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(k);
      setSortDir(k === "name" || k === "position" ? "asc" : "desc");
    }
  };

  const sortedRoster = useMemo(() => {
    const copy = [...roster];
    copy.sort((a, b) => {
      const va = sortValue(a, sortKey);
      const vb = sortValue(b, sortKey);
      const mult = sortDir === "asc" ? 1 : -1;
      if (typeof va === "string" && typeof vb === "string") {
        return va.localeCompare(vb) * mult;
      }
      const na = Number(va);
      const nb = Number(vb);
      if (na === nb) return a.player.name.localeCompare(b.player.name);
      return (na - nb) * mult;
    });
    return copy;
  }, [roster, sortKey, sortDir]);

  return (
    <div className="mx-auto max-w-6xl space-y-12 px-4 py-10">
      <section aria-labelledby="roster-heading">
        <h2 id="roster-heading" className="text-lg font-semibold text-white">
          Roster
        </h2>
        <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/80 text-xs">
                <Th label="Name" sortKey="name" active={sortKey} dir={sortDir} onSort={onSort} />
                <Th label="Pos" sortKey="position" active={sortKey} dir={sortDir} onSort={onSort} />
                <Th label="GP" sortKey="gp" active={sortKey} dir={sortDir} onSort={onSort} />
                <Th label="MIN" sortKey="min" active={sortKey} dir={sortDir} onSort={onSort} />
                <Th label="PTS" sortKey="pts" active={sortKey} dir={sortDir} onSort={onSort} />
                <Th label="REB" sortKey="reb" active={sortKey} dir={sortDir} onSort={onSort} />
                <Th label="AST" sortKey="ast" active={sortKey} dir={sortDir} onSort={onSort} />
                <Th label="STL" sortKey="stl" active={sortKey} dir={sortDir} onSort={onSort} />
                <Th label="BLK" sortKey="blk" active={sortKey} dir={sortDir} onSort={onSort} />
                <Th label="TO" sortKey="to" active={sortKey} dir={sortDir} onSort={onSort} />
                <Th label="FG%" sortKey="fg" active={sortKey} dir={sortDir} onSort={onSort} />
                <Th label="3P%" sortKey="tp" active={sortKey} dir={sortDir} onSort={onSort} />
                <Th label="FT%" sortKey="ft" active={sortKey} dir={sortDir} onSort={onSort} />
              </tr>
            </thead>
            <tbody>
              {sortedRoster.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-4 py-10 text-center text-zinc-500">
                    No active players on this team.
                  </td>
                </tr>
              ) : (
                sortedRoster.map(({ player, avg }) => (
                  <tr
                    key={player.id}
                    role="link"
                    tabIndex={0}
                    onClick={() => router.push(`/player/${player.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        router.push(`/player/${player.id}`);
                      }
                    }}
                    className="cursor-pointer border-b border-zinc-800/80 transition hover:bg-zinc-800/50"
                  >
                    <td className="px-2 py-2.5 font-medium text-zinc-100">{player.name}</td>
                    <td className="px-2 py-2.5 text-zinc-400">{player.position ?? "—"}</td>
                    <td className="px-2 py-2.5 font-mono text-zinc-300">{avg?.games_played ?? "—"}</td>
                    <td className="px-2 py-2.5 font-mono text-zinc-300">
                      {avg?.minutes_pg != null ? num(avg.minutes_pg)!.toFixed(1) : "—"}
                    </td>
                    <td className="px-2 py-2.5 font-mono text-zinc-200">{avg?.ppg != null ? num(avg.ppg)!.toFixed(1) : "—"}</td>
                    <td className="px-2 py-2.5 font-mono text-zinc-300">{avg?.rpg != null ? num(avg.rpg)!.toFixed(1) : "—"}</td>
                    <td className="px-2 py-2.5 font-mono text-zinc-300">{avg?.apg != null ? num(avg.apg)!.toFixed(1) : "—"}</td>
                    <td className="px-2 py-2.5 font-mono text-zinc-300">{avg?.spg != null ? num(avg.spg)!.toFixed(1) : "—"}</td>
                    <td className="px-2 py-2.5 font-mono text-zinc-300">{avg?.bpg != null ? num(avg.bpg)!.toFixed(1) : "—"}</td>
                    <td className="px-2 py-2.5 font-mono text-zinc-300">{avg?.topg != null ? num(avg.topg)!.toFixed(1) : "—"}</td>
                    <td className="px-2 py-2.5 font-mono text-zinc-400">{fmtPctCell(avg?.fg_pct)}</td>
                    <td className="px-2 py-2.5 font-mono text-zinc-400">{fmtPctCell(avg?.three_pct)}</td>
                    <td className="px-2 py-2.5 font-mono text-zinc-400">{fmtPctCell(avg?.ft_pct)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="team-game-log-heading">
        <h2 id="team-game-log-heading" className="text-lg font-semibold text-white">
          Game log
        </h2>
        <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full min-w-[900px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/80 text-xs uppercase tracking-wide text-zinc-500">
                <th className="px-3 py-3 font-medium">Date</th>
                <th className="px-3 py-3 font-medium">Opp</th>
                <th className="px-3 py-3 font-medium">W/L</th>
                <th className="px-3 py-3 font-medium">Score</th>
                <th className="px-3 py-3 font-medium">FG%</th>
                <th className="px-3 py-3 font-medium">3PT%</th>
                <th className="px-3 py-3 font-medium">REB</th>
                <th className="px-3 py-3 font-medium">AST</th>
                <th className="px-3 py-3 font-medium">TOV</th>
              </tr>
            </thead>
            <tbody>
              {gameLog.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-zinc-500">
                    No games in this season window yet.
                  </td>
                </tr>
              ) : (
                gameLog.map((row) => {
                  const g = row.game;
                  const res = resultWL(g, teamName);
                  const wlClass =
                    res === "W" ? "text-emerald-400" : res === "L" ? "text-red-400" : "text-zinc-400";
                  const fgP = pct(row.fg_made, row.fg_attempted);
                  const tpP = pct(row.three_made, row.three_attempted);
                  return (
                    <tr
                      key={row.id}
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
                      <td className="max-w-[12rem] truncate px-3 py-2.5 text-zinc-200">{opponentName(g, teamName)}</td>
                      <td className={`px-3 py-2.5 font-bold tabular-nums ${wlClass}`}>{res}</td>
                      <td className="px-3 py-2.5 font-mono text-zinc-300">{scoreDisplay(g, teamName)}</td>
                      <td className="px-3 py-2.5 font-mono text-zinc-400">
                        {fgP != null ? `${fgP.toFixed(1)}%` : "—"}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-zinc-400">
                        {tpP != null ? `${tpP.toFixed(1)}%` : "—"}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-zinc-300">{row.total_rebounds ?? "—"}</td>
                      <td className="px-3 py-2.5 font-mono text-zinc-300">{row.assists ?? "—"}</td>
                      <td className="px-3 py-2.5 font-mono text-zinc-300">{row.turnovers ?? "—"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
