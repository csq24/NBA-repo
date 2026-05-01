import type { GameRow } from "@/types/thread";

type GameScoreboardHeaderProps = {
  game: GameRow;
};

function formatStart(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function GameScoreboardHeader({ game }: GameScoreboardHeaderProps) {
  const home = game.home_score ?? "—";
  const away = game.away_score ?? "—";
  const leagueLabel = (game.league ?? "").trim() || "—";
  const homeName = (game.home_team ?? "").trim() || "Home";
  const awayName = (game.away_team ?? "").trim() || "Away";
  const startIso = game.start_time ?? "";

  return (
    <header className="border-b border-zinc-800 bg-gradient-to-b from-zinc-900 to-zinc-950 px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <p className="text-center text-xs font-medium uppercase tracking-widest text-zinc-500">
          {leagueLabel.toUpperCase()} · {startIso ? formatStart(startIso) : "—"}
        </p>

        <div className="mt-6 flex flex-col items-stretch gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1 text-center sm:text-right">
            <p className="text-lg font-semibold text-white sm:text-xl">{homeName}</p>
            <p className="mt-2 text-4xl font-black tabular-nums text-white sm:text-5xl">{home}</p>
          </div>

          <div className="flex shrink-0 flex-col items-center justify-center gap-1 px-4">
            <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs font-medium text-zinc-300 ring-1 ring-zinc-700">
              {game.status_detail?.trim() ? game.status_detail : game.status}
            </span>
            <span className="text-xs text-zinc-500">vs</span>
          </div>

          <div className="flex-1 text-center sm:text-left">
            <p className="text-lg font-semibold text-white sm:text-xl">{awayName}</p>
            <p className="mt-2 text-4xl font-black tabular-nums text-white sm:text-5xl">{away}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
