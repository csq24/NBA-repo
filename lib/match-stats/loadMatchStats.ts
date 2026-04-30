import type { SupabaseClient } from "@supabase/supabase-js";

import type { MatchPlayerStatRow, MatchRow, MatchStatsBundle, TeamAggregate } from "@/lib/match-stats/types";

type TeamRow = { id: string; name: string };

type MatchScoreRow = {
  home_team_id: string | null;
  away_team_id: string | null;
  home_score: number;
  away_score: number;
};

async function teamName(supabase: SupabaseClient, id: string | null): Promise<string | null> {
  if (!id) return null;
  const { data } = await supabase.from("teams").select("name").eq("id", id).maybeSingle();
  return (data as TeamRow | null)?.name ?? null;
}

function aggregateTeamFromMatches(
  teamId: string,
  teamName: string,
  rows: MatchScoreRow[],
): Omit<TeamAggregate, "top_scorer_name" | "top_scorer_goals" | "top_assister_name" | "top_assister_assists"> {
  let wins = 0;
  let draws = 0;
  let losses = 0;
  let goals_for = 0;
  let goals_against = 0;
  let clean_sheets = 0;

  for (const m of rows) {
    const isHome = m.home_team_id === teamId;
    const isAway = m.away_team_id === teamId;
    if (!isHome && !isAway) continue;
    const gf = Number(isHome ? m.home_score : m.away_score);
    const ga = Number(isHome ? m.away_score : m.home_score);
    goals_for += gf;
    goals_against += ga;
    if (ga === 0) clean_sheets += 1;
    if (gf > ga) wins += 1;
    else if (gf === ga) draws += 1;
    else losses += 1;
  }

  return {
    team_id: teamId,
    team_name: teamName,
    wins,
    draws,
    losses,
    goals_for,
    goals_against,
    goal_difference: goals_for - goals_against,
    clean_sheets,
  };
}

async function topScorerAssister(
  supabase: SupabaseClient,
  teamId: string,
): Promise<{
  top_scorer_name: string | null;
  top_scorer_goals: number;
  top_assister_name: string | null;
  top_assister_assists: number;
}> {
  const { data: players } = await supabase.from("players").select("id, name").eq("team_id", teamId);
  const roster = players ?? [];
  if (roster.length === 0) {
    return { top_scorer_name: null, top_scorer_goals: 0, top_assister_name: null, top_assister_assists: 0 };
  }
  const ids = roster.map((p) => p.id as string);
  const { data: stats } = await supabase.from("match_player_stats").select("player_id, goals, assists").in("player_id", ids);

  const byId = new Map<string, { goals: number; assists: number }>();
  for (const r of stats ?? []) {
    const pid = r.player_id as string;
    const cur = byId.get(pid) ?? { goals: 0, assists: 0 };
    cur.goals += Number(r.goals ?? 0);
    cur.assists += Number(r.assists ?? 0);
    byId.set(pid, cur);
  }

  let topG = 0;
  let topGName: string | null = null;
  let topA = 0;
  let topAName: string | null = null;
  for (const p of roster) {
    const pid = p.id as string;
    const agg = byId.get(pid) ?? { goals: 0, assists: 0 };
    if (agg.goals > topG) {
      topG = agg.goals;
      topGName = p.name as string;
    }
    if (agg.assists > topA) {
      topA = agg.assists;
      topAName = p.name as string;
    }
  }
  return {
    top_scorer_name: topG > 0 ? topGName : null,
    top_scorer_goals: topG,
    top_assister_name: topA > 0 ? topAName : null,
    top_assister_assists: topA,
  };
}

async function buildAggregate(
  supabase: SupabaseClient,
  teamId: string | null,
  fallbackName: string,
): Promise<TeamAggregate | null> {
  if (!teamId) return null;
  const name = (await teamName(supabase, teamId)) ?? fallbackName;
  const { data: matchRows, error } = await supabase
    .from("matches")
    .select("home_team_id, away_team_id, home_score, away_score")
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`);

  if (error) {
    console.error("[buildAggregate] matches", error.message);
    return null;
  }

  const base = aggregateTeamFromMatches(teamId, name, (matchRows ?? []) as MatchScoreRow[]);
  const tops = await topScorerAssister(supabase, teamId);
  return { ...base, ...tops };
}

export async function loadMatchStatsBundle(supabase: SupabaseClient, gameId: string): Promise<MatchStatsBundle> {
  const { data: gameRow } = await supabase.from("games").select("home_team, away_team").eq("id", gameId).maybeSingle();
  const homeLabel = (gameRow as { home_team?: string } | null)?.home_team ?? "Home";
  const awayLabel = (gameRow as { away_team?: string } | null)?.away_team ?? "Away";

  const { data: match, error: mErr } = await supabase.from("matches").select("*").eq("game_id", gameId).maybeSingle();

  if (mErr) {
    console.error("[loadMatchStatsBundle] matches", mErr.message);
  }

  if (!match) {
    return {
      match: null,
      players: [],
      homeAggregate: null,
      awayAggregate: null,
      homeLabel,
      awayLabel,
    };
  }

  const m = match as MatchRow;

  const { data: rawLines, error: pErr } = await supabase
    .from("match_player_stats")
    .select(
      `
      goals, assists, yellow_cards, red_cards, minutes_played, position,
      player_id,
      players ( id, name, team_id, position )
    `,
    )
    .eq("match_id", m.id);

  if (pErr) {
    console.error("[loadMatchStatsBundle] match_player_stats", pErr.message);
  }

  type PlayerJoin = { id: string; name: string; team_id: string; position: string | null };

  const players: MatchPlayerStatRow[] = [];
  for (const row of rawLines ?? []) {
    const rawPl = (row as { players?: PlayerJoin | PlayerJoin[] | null }).players;
    const pl = Array.isArray(rawPl) ? rawPl[0] : rawPl;
    if (!pl?.id) continue;
    players.push({
      player_id: pl.id,
      player_name: pl.name,
      team_id: pl.team_id,
      goals: Number((row as { goals?: number }).goals ?? 0),
      assists: Number((row as { assists?: number }).assists ?? 0),
      yellow_cards: Number((row as { yellow_cards?: number }).yellow_cards ?? 0),
      red_cards: Number((row as { red_cards?: number }).red_cards ?? 0),
      minutes_played: Number((row as { minutes_played?: number }).minutes_played ?? 0),
      position: (row as { position?: string | null }).position ?? pl.position ?? null,
    });
  }

  players.sort((a, b) => b.goals - a.goals || b.assists - a.assists || a.player_name.localeCompare(b.player_name));

  const [homeAggregate, awayAggregate] = await Promise.all([
    buildAggregate(supabase, m.home_team_id, homeLabel),
    buildAggregate(supabase, m.away_team_id, awayLabel),
  ]);

  return {
    match: m,
    players,
    homeAggregate,
    awayAggregate,
    homeLabel,
    awayLabel,
  };
}
