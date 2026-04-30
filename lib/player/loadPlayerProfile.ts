import type { SupabaseClient } from "@supabase/supabase-js";

import { inferBasketballSeasonLabel, seasonLabelToUtcRange } from "@/lib/player/season";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type TeamRow = {
  id: string;
  name: string;
  abbreviation: string;
  logo_url: string | null;
  league: string;
};

export type PlayerRow = {
  id: string;
  external_id: string;
  name: string;
  team_id: string;
  position: string | null;
  jersey_number: string | null;
  headshot_url: string | null;
};

export type PlayerSeasonAverageRow = {
  season: string;
  league: string;
  games_played: number;
  ppg: number | null;
  rpg: number | null;
  apg: number | null;
  spg: number | null;
  bpg: number | null;
  topg: number | null;
  fg_pct: number | null;
  three_pct: number | null;
  ft_pct: number | null;
  minutes_pg: number | null;
  player_id?: string;
};

export type GameJoinRow = {
  id: string;
  external_id: string;
  league: string;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  start_time: string;
  status: string;
};

export type GamePlayerStatJoin = {
  id: string;
  minutes: string | null;
  points: number | null;
  rebounds: number | null;
  assists: number | null;
  steals: number | null;
  blocks: number | null;
  turnovers: number | null;
  fouls: number | null;
  plus_minus: number | null;
  fg_made: number | null;
  fg_attempted: number | null;
  three_made: number | null;
  three_attempted: number | null;
  ft_made: number | null;
  ft_attempted: number | null;
  games: GameJoinRow | GameJoinRow[] | null;
};

function normalizeName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export function opponentName(game: GameJoinRow, teamName: string): string {
  const t = normalizeName(teamName);
  if (normalizeName(game.home_team) === t) return game.away_team;
  if (normalizeName(game.away_team) === t) return game.home_team;
  if (game.home_team.includes(teamName) || normalizeName(game.home_team).includes(t)) return game.away_team;
  return game.home_team;
}

export function resultWL(game: GameJoinRow, teamName: string): "W" | "L" | "—" {
  const hs = game.home_score;
  const as = game.away_score;
  if (hs == null || as == null) return "—";
  const isHome = normalizeName(game.home_team) === normalizeName(teamName);
  if (isHome) {
    if (hs > as) return "W";
    if (hs < as) return "L";
  } else {
    if (as > hs) return "W";
    if (as < hs) return "L";
  }
  return "—";
}

function unwrapGame(g: GameJoinRow | GameJoinRow[] | null): GameJoinRow | null {
  if (!g) return null;
  return Array.isArray(g) ? g[0] ?? null : g;
}

export type PlayerProfileData = {
  player: PlayerRow;
  team: TeamRow | null;
  seasonLabel: string;
  seasonAverages: PlayerSeasonAverageRow | null;
  /** Newest → oldest for table; sparklines use last 10 chronological. */
  gameLog: Array<GamePlayerStatJoin & { game: GameJoinRow }>;
  lastTenChronological: Array<GamePlayerStatJoin & { game: GameJoinRow }>;
  shootingTotals: {
    fgMade: number;
    fgAtt: number;
    thMade: number;
    thAtt: number;
    ftMade: number;
    ftAtt: number;
  };
  /** For PTS column heatmap; falls back to log mean if no season row. */
  referencePpg: number | null;
};

export async function loadPlayerProfile(
  supabase: SupabaseClient,
  idParam: string,
): Promise<PlayerProfileData | null> {
  const col = UUID_RE.test(idParam) ? "id" : "external_id";
  const { data: player, error: pErr } = await supabase
    .from("players")
    .select("id, external_id, name, team_id, position, jersey_number, headshot_url")
    .eq(col, idParam)
    .maybeSingle();

  if (pErr || !player) return null;

  const { data: team } = await supabase
    .from("teams")
    .select("id, name, abbreviation, logo_url, league")
    .eq("id", player.team_id)
    .maybeSingle();

  const { data: avgRows } = await supabase
    .from("player_season_averages")
    .select(
      "season, league, games_played, ppg, rpg, apg, spg, bpg, topg, fg_pct, three_pct, ft_pct, minutes_pg",
    )
    .eq("player_id", player.id)
    .order("season", { ascending: false })
    .limit(3);

  const envSeason = process.env.NEXT_PUBLIC_STATS_SEASON?.trim();
  const seasonAverages = (
    envSeason
      ? ((avgRows?.find((r) => r.season === envSeason) ?? avgRows?.[0]) as PlayerSeasonAverageRow | undefined)
      : (avgRows?.[0] as PlayerSeasonAverageRow | undefined)
  ) ?? null;

  const seasonLabel =
    envSeason ?? seasonAverages?.season ?? inferBasketballSeasonLabel(new Date());
  const range = seasonLabelToUtcRange(seasonLabel);

  const { data: rawStats, error: sErr } = await supabase
    .from("game_player_stats")
    .select(
      `
      id, minutes, points, rebounds, assists, steals, blocks, turnovers, fouls, plus_minus,
      fg_made, fg_attempted, three_made, three_attempted, ft_made, ft_attempted,
      games (
        id, external_id, league, home_team, away_team, home_score, away_score, start_time, status
      )
    `,
    )
    .eq("player_id", player.id);

  if (sErr) {
    console.error("[loadPlayerProfile] game_player_stats", sErr.message);
  }

  const rows: Array<GamePlayerStatJoin & { game: GameJoinRow }> = [];

  for (const row of rawStats ?? []) {
    const g = unwrapGame(row.games as GameJoinRow | GameJoinRow[] | null);
    if (!g?.start_time) continue;
    if (range) {
      const t = new Date(g.start_time).getTime();
      if (t < range.start.getTime() || t > range.end.getTime()) continue;
    }
    rows.push({ ...row, game: g });
  }

  rows.sort((a, b) => new Date(b.game.start_time).getTime() - new Date(a.game.start_time).getTime());

  const shootingTotals = rows.reduce(
    (acc, r) => {
      acc.fgMade += r.fg_made ?? 0;
      acc.fgAtt += r.fg_attempted ?? 0;
      acc.thMade += r.three_made ?? 0;
      acc.thAtt += r.three_attempted ?? 0;
      acc.ftMade += r.ft_made ?? 0;
      acc.ftAtt += r.ft_attempted ?? 0;
      return acc;
    },
    { fgMade: 0, fgAtt: 0, thMade: 0, thAtt: 0, ftMade: 0, ftAtt: 0 },
  );

  const lastTenNewest = rows.slice(0, 10);
  const lastTenChronological = [...lastTenNewest].reverse();

  const referencePpg =
    seasonAverages?.ppg != null
      ? Number(seasonAverages.ppg)
      : rows.length > 0
        ? rows.reduce((s, r) => s + (r.points ?? 0), 0) / rows.length
        : null;

  return {
    player: player as PlayerRow,
    team: (team as TeamRow | null) ?? null,
    seasonLabel,
    seasonAverages: seasonAverages ?? null,
    gameLog: rows,
    lastTenChronological,
    shootingTotals,
    referencePpg: referencePpg != null && Number.isFinite(referencePpg) ? referencePpg : null,
  };
}
