import type { SupabaseClient } from "@supabase/supabase-js";

import { sideForTeam } from "@/lib/game/matchTeamSide";
import type {
  GameBoxscoreSnapshot,
  GamePlayerStatsRow,
  GameTeamStatsRow,
  PlayerMini,
  PlayerStatLine,
  TeamMini,
  TeamSideBundle,
} from "@/lib/game/types";

type TeamRowDb = {
  id: string;
  name: string;
  abbreviation: string;
  logo_url: string | null;
};

type GameTeamStatJoin = GameTeamStatsRow & { teams: TeamRowDb | TeamRowDb[] | null };
type GamePlayerStatJoin = GamePlayerStatsRow & { players: PlayerMini | PlayerMini[] | null };

function unwrapOne<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function toTeamMini(t: TeamRowDb): TeamMini {
  return {
    id: t.id,
    name: t.name,
    abbreviation: t.abbreviation,
    logo_url: t.logo_url,
  };
}

export async function loadGameBoxscore(
  supabase: SupabaseClient,
  gameId: string,
): Promise<GameBoxscoreSnapshot | null> {
  const { data: gameRow, error: gErr } = await supabase.from("games").select("*").eq("id", gameId).maybeSingle();

  if (gErr || !gameRow) {
    if (gErr) console.error("[loadGameBoxscore] games", gErr.message);
    return null;
  }

  const game = gameRow as GameBoxscoreSnapshot["game"];

  const { data: gtsRows, error: tsErr } = await supabase
    .from("game_team_stats")
    .select(
      `
      game_id, team_id, points, fg_made, fg_attempted, three_made, three_attempted,
      ft_made, ft_attempted, offensive_rebounds, defensive_rebounds, total_rebounds,
      assists, steals, blocks, turnovers, fast_break_points, points_in_paint,
      second_chance_points, bench_points,
      teams ( id, name, abbreviation, logo_url )
    `,
    )
    .eq("game_id", gameId);

  if (tsErr) {
    console.error("[loadGameBoxscore] game_team_stats", tsErr.message);
  }

  const { data: gpsRows, error: psErr } = await supabase
    .from("game_player_stats")
    .select(
      `
      game_id, player_id, team_id, minutes, points, rebounds, assists, steals, blocks,
      turnovers, fouls, plus_minus, fg_made, fg_attempted, three_made, three_attempted,
      ft_made, ft_attempted, starter,
      players ( id, name, position, jersey_number, headshot_url )
    `,
    )
    .eq("game_id", gameId);

  if (psErr) {
    console.error("[loadGameBoxscore] game_player_stats", psErr.message);
  }

  let home: TeamSideBundle | null = null;
  let away: TeamSideBundle | null = null;
  const sideByTeamId = new Map<string, "home" | "away">();

  for (const row of (gtsRows ?? []) as GameTeamStatJoin[]) {
    const t = unwrapOne(row.teams);
    if (!t?.id) continue;
    const side = sideForTeam(game.home_team, game.away_team, t.name, t.abbreviation);
    if (!side) continue;
    const bundle: TeamSideBundle = {
      side,
      team: toTeamMini(t),
      stats: {
        game_id: row.game_id,
        team_id: row.team_id,
        points: row.points,
        fg_made: row.fg_made,
        fg_attempted: row.fg_attempted,
        three_made: row.three_made,
        three_attempted: row.three_attempted,
        ft_made: row.ft_made,
        ft_attempted: row.ft_attempted,
        offensive_rebounds: row.offensive_rebounds,
        defensive_rebounds: row.defensive_rebounds,
        total_rebounds: row.total_rebounds,
        assists: row.assists,
        steals: row.steals,
        blocks: row.blocks,
        turnovers: row.turnovers,
        fast_break_points: row.fast_break_points,
        points_in_paint: row.points_in_paint,
        second_chance_points: row.second_chance_points,
        bench_points: row.bench_points,
      },
    };
    if (side === "home") home = bundle;
    else away = bundle;
    sideByTeamId.set(t.id, side);
  }

  // Fallback for games where player rows exist but team stat rows are missing/unmatched:
  // resolve team side from participating `game_player_stats.team_id` values.
  if ((!home || !away) && (gpsRows?.length ?? 0) > 0) {
    const teamIds = Array.from(new Set((gpsRows ?? []).map((r) => String((r as GamePlayerStatJoin).team_id))));
    if (teamIds.length > 0) {
      const { data: teamRows } = await supabase
        .from("teams")
        .select("id, name, abbreviation, logo_url")
        .in("id", teamIds);

      for (const t of (teamRows ?? []) as TeamRowDb[]) {
        const side = sideForTeam(game.home_team, game.away_team, t.name, t.abbreviation);
        if (!side) continue;
        sideByTeamId.set(t.id, side);
        if (side === "home" && !home) {
          home = { side: "home", team: toTeamMini(t), stats: null };
        } else if (side === "away" && !away) {
          away = { side: "away", team: toTeamMini(t), stats: null };
        }
      }
    }
  }

  const homePlayers: PlayerStatLine[] = [];
  const awayPlayers: PlayerStatLine[] = [];
  const homeTeamId = home?.team.id ?? null;
  const awayTeamId = away?.team.id ?? null;

  for (const row of (gpsRows ?? []) as GamePlayerStatJoin[]) {
    const p = unwrapOne(row.players);
    if (!p?.id) continue;
    const line: PlayerStatLine = {
      player: {
        id: p.id,
        name: p.name,
        position: p.position,
        jersey_number: p.jersey_number,
        headshot_url: p.headshot_url,
      },
      stats: {
        game_id: row.game_id,
        player_id: row.player_id,
        team_id: row.team_id,
        minutes: row.minutes,
        points: row.points,
        rebounds: row.rebounds,
        assists: row.assists,
        steals: row.steals,
        blocks: row.blocks,
        turnovers: row.turnovers,
        fouls: row.fouls,
        plus_minus: row.plus_minus,
        fg_made: row.fg_made,
        fg_attempted: row.fg_attempted,
        three_made: row.three_made,
        three_attempted: row.three_attempted,
        ft_made: row.ft_made,
        ft_attempted: row.ft_attempted,
        starter: row.starter,
      },
    };
    if (homeTeamId && row.team_id === homeTeamId) {
      homePlayers.push(line);
      continue;
    }
    if (awayTeamId && row.team_id === awayTeamId) {
      awayPlayers.push(line);
      continue;
    }
    const fallbackSide = sideByTeamId.get(row.team_id);
    if (fallbackSide === "home") homePlayers.push(line);
    else if (fallbackSide === "away") awayPlayers.push(line);
  }

  const sortLines = (a: PlayerStatLine, b: PlayerStatLine) => {
    if (a.stats.starter !== b.stats.starter) return a.stats.starter ? -1 : 1;
    const pa = a.stats.points ?? -1;
    const pb = b.stats.points ?? -1;
    return pb - pa;
  };
  homePlayers.sort(sortLines);
  awayPlayers.sort(sortLines);

  return {
    game: {
      id: game.id,
      league: game.league,
      home_team: game.home_team,
      away_team: game.away_team,
      home_score: game.home_score,
      away_score: game.away_score,
      status: game.status,
      status_detail: game.status_detail ?? null,
      start_time: game.start_time,
      external_id: game.external_id,
      stats_synced: (game as { stats_synced?: boolean | null }).stats_synced ?? null,
    },
    home,
    away,
    homePlayers,
    awayPlayers,
  };
}
