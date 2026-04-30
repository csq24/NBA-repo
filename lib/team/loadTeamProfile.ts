import type { SupabaseClient } from "@supabase/supabase-js";

import type { GameJoinRow, PlayerSeasonAverageRow, TeamRow } from "@/lib/player/loadPlayerProfile";
import { resultWL } from "@/lib/player/loadPlayerProfile";
import { inferBasketballSeasonLabel, seasonLabelToUtcRange } from "@/lib/player/season";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type TeamSeasonStatsRow = {
  season: string;
  games_played: number;
  wins: number;
  losses: number;
  ppg: number | null;
  opp_ppg: number | null;
  fg_pct: number | null;
  three_pct: number | null;
  ft_pct: number | null;
  rpg: number | null;
  apg: number | null;
  spg: number | null;
  bpg: number | null;
  topg: number | null;
};

export type GameTeamStatJoin = {
  id: string;
  game_id: string;
  team_id: string;
  points: number | null;
  fg_made: number | null;
  fg_attempted: number | null;
  three_made: number | null;
  three_attempted: number | null;
  ft_made: number | null;
  ft_attempted: number | null;
  total_rebounds: number | null;
  assists: number | null;
  steals: number | null;
  blocks: number | null;
  turnovers: number | null;
  games: GameJoinRow | GameJoinRow[] | null;
};

export type RosterRow = {
  player: {
    id: string;
    external_id: string;
    name: string;
    position: string | null;
    jersey_number: string | null;
  };
  avg: PlayerSeasonAverageRow | null;
};

export type TeamProfileData = {
  team: TeamRow;
  seasonLabel: string;
  seasonStats: TeamSeasonStatsRow | null;
  roster: RosterRow[];
  gameLog: Array<GameTeamStatJoin & { game: GameJoinRow }>;
  /** Oldest → newest of the last five games (for form strip). */
  lastFiveForm: ("W" | "L")[];
  recordDisplay: string;
};

function unwrapGame(g: GameJoinRow | GameJoinRow[] | null): GameJoinRow | null {
  if (!g) return null;
  return Array.isArray(g) ? g[0] ?? null : g;
}

export function scoreDisplay(game: GameJoinRow, teamName: string): string {
  const hs = game.home_score;
  const as = game.away_score;
  if (hs == null || as == null) return "—";
  const isHome = game.home_team.trim().toLowerCase() === teamName.trim().toLowerCase();
  if (isHome) return `${hs}-${as}`;
  return `${as}-${hs}`;
}

export async function loadTeamProfile(
  supabase: SupabaseClient,
  idParam: string,
): Promise<TeamProfileData | null> {
  if (!UUID_RE.test(idParam)) return null;

  const { data: team, error: tErr } = await supabase
    .from("teams")
    .select("id, name, abbreviation, logo_url, league")
    .eq("id", idParam)
    .maybeSingle();

  if (tErr || !team) return null;

  const envSeason = process.env.NEXT_PUBLIC_STATS_SEASON?.trim();
  const seasonLabel = envSeason ?? inferBasketballSeasonLabel(new Date());
  const range = seasonLabelToUtcRange(seasonLabel);

  const { data: tss } = await supabase
    .from("team_season_stats")
    .select(
      "season, games_played, wins, losses, ppg, opp_ppg, fg_pct, three_pct, ft_pct, rpg, apg, spg, bpg, topg",
    )
    .eq("team_id", team.id)
    .eq("season", seasonLabel)
    .maybeSingle();

  const { data: playerRows, error: pErr } = await supabase
    .from("players")
    .select("id, external_id, name, position, jersey_number")
    .eq("team_id", team.id)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (pErr) {
    console.error("[loadTeamProfile] players", pErr.message);
  }

  const ids = (playerRows ?? []).map((p) => p.id as string);
  const avgByPlayer = new Map<string, PlayerSeasonAverageRow>();

  if (ids.length > 0) {
    const { data: avgRows, error: aErr } = await supabase
      .from("player_season_averages")
      .select(
        "player_id, season, league, games_played, ppg, rpg, apg, spg, bpg, topg, fg_pct, three_pct, ft_pct, minutes_pg",
      )
      .in("player_id", ids)
      .eq("season", seasonLabel);

    if (aErr) {
      console.error("[loadTeamProfile] player_season_averages", aErr.message);
    }
    for (const row of avgRows ?? []) {
      const pid = row.player_id as string;
      avgByPlayer.set(pid, row as PlayerSeasonAverageRow);
    }
  }

  const roster: RosterRow[] = (playerRows ?? []).map((p) => ({
    player: {
      id: p.id as string,
      external_id: p.external_id as string,
      name: p.name as string,
      position: (p.position as string | null) ?? null,
      jersey_number: (p.jersey_number as string | null) ?? null,
    },
    avg: avgByPlayer.get(p.id as string) ?? null,
  }));

  const { data: gtsRaw, error: gErr } = await supabase
    .from("game_team_stats")
    .select(
      `
      id, game_id, team_id, points, fg_made, fg_attempted, three_made, three_attempted,
      ft_made, ft_attempted, total_rebounds, assists, steals, blocks, turnovers,
      games (
        id, external_id, league, home_team, away_team, home_score, away_score, start_time, status
      )
    `,
    )
    .eq("team_id", team.id);

  if (gErr) {
    console.error("[loadTeamProfile] game_team_stats", gErr.message);
  }

  const teamName = team.name as string;
  const merged: Array<GameTeamStatJoin & { game: GameJoinRow }> = [];

  for (const row of gtsRaw ?? []) {
    const g = unwrapGame(row.games as GameJoinRow | GameJoinRow[] | null);
    if (!g?.start_time) continue;
    if (range) {
      const t = new Date(g.start_time).getTime();
      if (t < range.start.getTime() || t > range.end.getTime()) continue;
    }
    merged.push({ ...(row as GameTeamStatJoin), game: g });
  }

  merged.sort((a, b) => new Date(b.game.start_time).getTime() - new Date(a.game.start_time).getTime());

  let wins = tss?.wins ?? 0;
  let losses = tss?.losses ?? 0;
  if (!tss && merged.length > 0) {
    wins = 0;
    losses = 0;
    for (const row of merged) {
      const r = resultWL(row.game, teamName);
      if (r === "W") wins++;
      if (r === "L") losses++;
    }
  }

  const newestFive = merged.slice(0, 5);
  const lastFiveChronological = [...newestFive].reverse();
  const lastFiveForm: ("W" | "L")[] = lastFiveChronological
    .map((row) => {
      const r = resultWL(row.game, teamName);
      return r === "W" || r === "L" ? r : null;
    })
    .filter((x): x is "W" | "L" => x !== null);

  return {
    team: team as TeamRow,
    seasonLabel,
    seasonStats: (tss as TeamSeasonStatsRow | null) ?? null,
    roster,
    gameLog: merged,
    lastFiveForm,
    recordDisplay: `${wins}-${losses}`,
  };
}

export { opponentName, resultWL } from "@/lib/player/loadPlayerProfile";
