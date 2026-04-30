"use client";

import Link from "next/link";

import { TeamLogoImg } from "@/components/TeamLogoImg";
import type { Game } from "@/lib/api/espn";

function statusLabel(kind: Game["status_kind"]): string {
  switch (kind) {
    case "live":
      return "Live";
    case "final":
      return "Final";
    default:
      return "Scheduled";
  }
}

function statusStyles(kind: Game["status_kind"]): string {
  switch (kind) {
    case "live":
      return "bg-red-500/20 text-red-300 ring-1 ring-red-500/40";
    case "final":
      return "bg-zinc-700 text-zinc-200 ring-1 ring-zinc-600";
    default:
      return "bg-zinc-800 text-zinc-400 ring-1 ring-zinc-700";
  }
}

type GameCardProps = {
  game: Game;
};

export function GameCard({ game }: GameCardProps) {
  const homeScore =
    game.home_score === null || game.home_score === undefined ? "—" : game.home_score;
  const awayScore =
    game.away_score === null || game.away_score === undefined ? "—" : game.away_score;
  const startLocal = new Date(game.start_time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  return (
    <div className="group flex flex-col rounded-xl border border-zinc-800 bg-[#1a1a1a] p-4 shadow-sm transition hover:border-zinc-600 hover:bg-zinc-900">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${statusStyles(game.status_kind)}`}
        >
          {statusLabel(game.status_kind)}
        </span>
        <span className="truncate text-right text-xs text-zinc-500">
          {game.status_kind === "scheduled" ? startLocal : game.status}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-zinc-800">
            <TeamLogoImg
              src={game.home_logo_url}
              alt=""
              className="h-full w-full object-contain p-1"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-zinc-500">{game.home_abbr ?? "HOME"}</p>
            <p className="truncate font-medium text-zinc-100">{game.home_team}</p>
            <p className="text-2xl font-bold tabular-nums text-white">{homeScore}</p>
          </div>
        </div>

        <div className="flex items-center justify-center text-xs font-medium uppercase tracking-widest text-zinc-500">
          vs
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-zinc-800">
            <TeamLogoImg
              src={game.away_logo_url}
              alt=""
              className="h-full w-full object-contain p-1"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-zinc-500">{game.away_abbr ?? "AWAY"}</p>
            <p className="truncate font-medium text-zinc-100">{game.away_team}</p>
            <p className="text-2xl font-bold tabular-nums text-white">{awayScore}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-zinc-800 pt-3">
        <span className="truncate text-xs text-zinc-500">{game.venue ?? "Venue TBA"}</span>
        <Link
          href={`/game/${game.external_id}`}
          className="rounded-full bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-100 transition hover:bg-zinc-700"
        >
          Details
        </Link>
      </div>
    </div>
  );
}
