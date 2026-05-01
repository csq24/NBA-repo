import type { SupabaseClient } from "@supabase/supabase-js";

import {
  canonicalGameStatusFromKind,
  getEspnBaseUrl,
  getEspnLeaguePath,
  getEspnSummaryUrls,
  type GameStatusKind,
} from "@/lib/api/espn";

export type SyncGameStatsResult = {
  ok: boolean;
  error?: string;
  /** ESPN reports the event as finished — caller may set `games.stats_synced` after success. */
  isFinalCompleted: boolean;
  /** True when league/body shape is skipped intentionally (no DB writes). */
  skipped?: boolean;
  /** `public.games.id` for this sync. */
  gameId?: string;
  /** Rows upserted into `game_team_stats` (0 when skipped or error). */
  teamsUpserted?: number;
  /** Rows upserted into `game_player_stats` (0 when skipped or error). */
  playersUpserted?: number;
};

type EspnSummaryTeam = {
  id?: string;
  abbreviation?: string;
  displayName?: string;
  shortDisplayName?: string;
  logo?: string;
};

type EspnStatLine = { name: string; displayValue?: string };

type EspnAthleteWrap = {
  starter?: boolean;
  didNotPlay?: boolean;
  stats?: string[];
  athlete?: {
    id?: string;
    displayName?: string;
    shortName?: string;
    jersey?: string;
    headshot?: { href?: string };
    position?: { abbreviation?: string };
  };
};

type EspnBoxscorePlayersTeam = {
  team?: EspnSummaryTeam;
  statistics?: Array<{
    keys?: string[];
    athletes?: EspnAthleteWrap[];
  }>;
};

type EspnBoxscoreTeam = {
  team?: EspnSummaryTeam;
  statistics?: EspnStatLine[];
  homeAway?: string;
};

type EspnSummary = {
  header?: {
    competitions?: Array<{
      competitors?: Array<{
        homeAway?: string;
        team?: EspnSummaryTeam;
        score?: string;
      }>;
      status?: {
        type?: {
          completed?: boolean;
          state?: string;
          name?: string;
          shortDetail?: string;
          detail?: string;
          description?: string;
        };
      };
    }>;
  };
  boxscore?: {
    teams?: EspnBoxscoreTeam[];
    players?: EspnBoxscorePlayersTeam[];
  };
};

type SummaryFetchResult = {
  ok: boolean;
  status: number;
  url: string;
  bodyText: string;
  error?: string;
};

const ESPN_SYNC_TIMEOUT_MS = 15_000;

async function fetchNoStoreWithTimeout(url: string, timeoutMs = ESPN_SYNC_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { cache: "no-store", signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

function parseEspnSummaryFromBody(bodyText: string): EspnSummary | null {
  try {
    const parsed = JSON.parse(bodyText) as Record<string, unknown>;
    if (parsed && typeof parsed === "object") {
      if ("header" in parsed && "boxscore" in parsed) {
        return parsed as EspnSummary;
      }
      const wrapped = parsed["gamepackageJSON"];
      if (wrapped && typeof wrapped === "object" && "header" in wrapped && "boxscore" in wrapped) {
        return wrapped as EspnSummary;
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchSummaryFromCandidates(urls: string[]): Promise<SummaryFetchResult> {
  let lastError = "No ESPN summary URLs to try";
  for (const url of urls) {
    console.info("[statSync] ESPN GET %s", url);
    let res: Response;
    try {
      res = await fetchNoStoreWithTimeout(url);
    } catch (e) {
      lastError = e instanceof Error ? e.message : "fetch failed";
      console.warn("[statSync] ESPN fetch error url=%s err=%s", url, lastError);
      continue;
    }

    let bodyText = "";
    try {
      bodyText = await res.text();
    } catch (e) {
      lastError = e instanceof Error ? `read body: ${e.message}` : "read body failed";
      console.warn("[statSync] ESPN read-body error url=%s err=%s", url, lastError);
      continue;
    }

    const preview = bodyText.length > 500 ? `${bodyText.slice(0, 500)}…` : bodyText;
    console.info("[statSync] ESPN response status=%s body_first_500=%s", res.status, preview);

    if (res.ok) {
      return { ok: true, status: res.status, url, bodyText };
    }
    lastError = `ESPN summary ${res.status}: ${url}`;
  }

  return { ok: false, status: 0, url: urls[0] ?? "", bodyText: "", error: lastError };
}

function parseMadeAttempted(raw: string | undefined): { made: number | null; attempted: number | null } {
  if (raw == null || raw === "" || raw === "--") return { made: null, attempted: null };
  const m = String(raw).trim().match(/^(\d+)\s*-\s*(\d+)$/);
  if (!m) return { made: null, attempted: null };
  const made = Number.parseInt(m[1], 10);
  const attempted = Number.parseInt(m[2], 10);
  return {
    made: Number.isNaN(made) ? null : made,
    attempted: Number.isNaN(attempted) ? null : attempted,
  };
}

function parseIntStat(raw: string | undefined): number | null {
  if (raw == null || raw === "" || raw === "--") return null;
  const n = Number.parseInt(String(raw).replace(/^\+/, ""), 10);
  return Number.isNaN(n) ? null : n;
}

function parseNumberStat(raw: string | undefined): number | null {
  if (raw == null || raw === "" || raw === "--") return null;
  const n = Number.parseFloat(String(raw).replace(/^\+/, ""));
  return Number.isNaN(n) ? null : n;
}

function statMap(stats: EspnStatLine[] | undefined): Record<string, string> {
  const m: Record<string, string> = {};
  if (!stats) return m;
  for (const s of stats) {
    if (s?.name) m[s.name] = s.displayValue ?? "";
  }
  return m;
}

function teamPointsFromHeader(summary: EspnSummary): Map<string, number | null> {
  const out = new Map<string, number | null>();
  const comps = summary.header?.competitions?.[0]?.competitors ?? [];
  for (const c of comps) {
    const abbr = c.team?.abbreviation?.trim();
    if (!abbr) continue;
    const raw = c.score;
    if (raw == null || raw === "") {
      out.set(abbr, null);
      continue;
    }
    const n = Number.parseInt(String(raw), 10);
    out.set(abbr, Number.isNaN(n) ? null : n);
  }
  return out;
}

function summaryIsFinalCompleted(summary: EspnSummary): boolean {
  const t = summary.header?.competitions?.[0]?.status?.type;
  if (t?.completed === true) return true;
  if (t?.state === "post") return true;
  const name = t?.name ?? "";
  return name.includes("FINAL") || name.includes("OFFICIAL");
}

/** Leagues with no usable ESPN box score for this schema. */
const SKIP_LEAGUES = new Set(["ufc", "soccer-mls"]);

/**
 * Only these slugs use ESPN’s basketball `statistics[].keys` (`points`, `fieldGoalsMade-fieldGoalsAttempted`, …).
 * NFL/NHL/MLB use different keys; syncing them filled `game_player_stats` with mostly nulls / wrong semantics.
 */
const BASKETBALL_BOX_LEAGUES = new Set(["nba", "college-basketball"]);
const HOCKEY_BOX_LEAGUES = new Set(["nhl"]);
const BASEBALL_BOX_LEAGUES = new Set(["mlb"]);

/** Leagues that receive full ESPN box score → DB sync (NBA, CBB, NHL, MLB). */
export function isBoxScoreLeague(leagueSlug: string): boolean {
  const k = leagueSlug.toLowerCase().trim();
  if (SKIP_LEAGUES.has(k)) return false;
  return (
    BASKETBALL_BOX_LEAGUES.has(k) || HOCKEY_BOX_LEAGUES.has(k) || BASEBALL_BOX_LEAGUES.has(k)
  );
}

function parseScoreStr(raw: string | undefined): number | null {
  if (raw === undefined || raw === "") return null;
  const n = Number.parseInt(String(raw), 10);
  return Number.isNaN(n) ? null : n;
}

function summaryCompetitionStatusKind(
  competition: NonNullable<NonNullable<EspnSummary["header"]>["competitions"]>[number],
): GameStatusKind {
  const t = competition?.status?.type;
  if (!t) return "scheduled";
  if (t.completed === true) return "final";
  const state = t.state;
  if (state === "in") return "live";
  if (state === "post") return "final";
  if (state === "pre") return "scheduled";
  const name = t.name ?? "";
  if (name.includes("FINAL")) return "final";
  if (
    name.includes("IN_PROGRESS") ||
    name.includes("HALFTIME") ||
    name.includes("END_PERIOD") ||
    name.includes("DELAYED")
  ) {
    return "live";
  }
  return "scheduled";
}

function statusDetailFromCompetition(
  competition: NonNullable<NonNullable<EspnSummary["header"]>["competitions"]>[number],
): string {
  const t = competition?.status?.type;
  return (
    t?.shortDetail ?? t?.detail ?? t?.description ?? t?.name ?? t?.state ?? "Unknown"
  );
}

/**
 * Updates `public.games` status + scores from ESPN summary so DB rows are not stuck on
 * `scheduled` when the scoreboard upsert has not run (fixes cron + game page missing box targets).
 */
export async function refreshGameRowFromEspn(
  supabase: SupabaseClient,
  game: { id: string; external_id: string; league: string },
): Promise<{ ok: boolean; error?: string }> {
  const leagueSlug = game.league.toLowerCase().trim();
  if (!isBoxScoreLeague(leagueSlug)) {
    return { ok: true };
  }

  const path = getEspnLeaguePath(leagueSlug);
  if (!path) {
    return { ok: false, error: `Unknown league: ${game.league}` };
  }

  const candidates = getEspnSummaryUrls(path, game.external_id, leagueSlug);
  const fetched = await fetchSummaryFromCandidates(candidates);
  if (!fetched.ok) {
    return { ok: false, error: fetched.error ?? "ESPN summary fetch failed" };
  }
  const summary = parseEspnSummaryFromBody(fetched.bodyText);
  if (!summary) {
    return { ok: false, error: "Invalid ESPN JSON" };
  }

  const competition = summary.header?.competitions?.[0];
  if (!competition) {
    return { ok: false, error: "Missing competition header" };
  }

  const kind = summaryCompetitionStatusKind(competition);
  const status = canonicalGameStatusFromKind(kind);
  const status_detail = statusDetailFromCompetition(competition);

  let home_score: number | null = null;
  let away_score: number | null = null;
  for (const c of competition.competitors ?? []) {
    const sc = parseScoreStr(c.score);
    if (c.homeAway === "home") home_score = sc;
    if (c.homeAway === "away") away_score = sc;
  }

  const { error } = await supabase
    .from("games")
    .update({
      status,
      status_detail,
      home_score,
      away_score,
    })
    .eq("id", game.id);

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

async function ensureTeamId(
  supabase: SupabaseClient,
  leagueSlug: string,
  team: NonNullable<EspnBoxscoreTeam["team"]>,
): Promise<string | null> {
  const abbr = team.abbreviation?.trim();
  const name = team.displayName ?? team.shortDisplayName ?? abbr ?? "Unknown";
  if (!abbr) return null;

  const { data: existing } = await supabase
    .from("teams")
    .select("id")
    .eq("league", leagueSlug)
    .ilike("abbreviation", abbr)
    .maybeSingle();

  if (existing?.id) return existing.id as string;

  const { data: inserted, error } = await supabase
    .from("teams")
    .insert({
      name,
      abbreviation: abbr,
      league: leagueSlug,
      logo_url: team.logo ?? null,
    })
    .select("id")
    .maybeSingle();

  if (!error && inserted?.id) return inserted.id as string;

  const { data: again } = await supabase
    .from("teams")
    .select("id")
    .eq("league", leagueSlug)
    .ilike("abbreviation", abbr)
    .maybeSingle();
  return (again?.id as string | undefined) ?? null;
}

function statByKey(stats: string[] | undefined, keys: string[] | undefined, key: string): string | undefined {
  if (!stats || !keys) return undefined;
  const idx = keys.indexOf(key);
  if (idx < 0 || idx >= stats.length) return undefined;
  return stats[idx];
}

function totalsByKey(totals: string[] | undefined, keys: string[] | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!totals || !keys) return out;
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (!k) continue;
    out[k] = totals[i] ?? "";
  }
  return out;
}

/**
 * Loads `games` by primary key + ESPN id, then syncs boxscore from ESPN `summary`.
 * Caller sets `games.stats_synced` when `isFinalCompleted` is true (final only).
 */
export async function syncGameStats(
  supabase: SupabaseClient,
  gameId: string,
  externalId: string,
): Promise<SyncGameStatsResult> {
  const { data: row, error: loadErr } = await supabase
    .from("games")
    .select("id, external_id, league")
    .eq("id", gameId)
    .eq("external_id", externalId)
    .maybeSingle();

  if (loadErr) {
    return { ok: false, error: loadErr.message, isFinalCompleted: false, gameId };
  }
  if (!row) {
    return { ok: false, error: "Game not found for id + external_id", isFinalCompleted: false, gameId };
  }

  return syncGameStatsForRow(supabase, row as { id: string; external_id: string; league: string });
}

/**
 * Fetches ESPN `summary` for the game’s `external_id`, upserts `players`, `game_player_stats`, and `game_team_stats`.
 */
async function syncGameStatsForRow(
  supabase: SupabaseClient,
  game: { id: string; external_id: string; league: string },
): Promise<SyncGameStatsResult> {
  const leagueSlug = game.league.toLowerCase().trim();
  if (
    SKIP_LEAGUES.has(leagueSlug) ||
    (!BASKETBALL_BOX_LEAGUES.has(leagueSlug) &&
      !HOCKEY_BOX_LEAGUES.has(leagueSlug) &&
      !BASEBALL_BOX_LEAGUES.has(leagueSlug))
  ) {
    return { ok: true, skipped: true, isFinalCompleted: false, gameId: game.id, teamsUpserted: 0, playersUpserted: 0 };
  }

  const path = getEspnLeaguePath(leagueSlug);
  if (!path) {
    return { ok: false, error: `Unknown league: ${game.league}`, isFinalCompleted: false, gameId: game.id };
  }

  const candidates = getEspnSummaryUrls(path, game.external_id, leagueSlug);
  const fetched = await fetchSummaryFromCandidates(candidates);
  if (!fetched.ok) {
    return { ok: false, error: fetched.error ?? "ESPN summary fetch failed", isFinalCompleted: false, gameId: game.id };
  }
  const summary = parseEspnSummaryFromBody(fetched.bodyText);
  if (!summary) {
    return { ok: false, error: "Invalid ESPN JSON", isFinalCompleted: false, gameId: game.id };
  }

  const isFinalCompleted = summaryIsFinalCompleted(summary);

  const competitionMeta = summary.header?.competitions?.[0];
  if (competitionMeta) {
    const kind = summaryCompetitionStatusKind(competitionMeta);
    const status = canonicalGameStatusFromKind(kind);
    const status_detail = statusDetailFromCompetition(competitionMeta);
    let home_score: number | null = null;
    let away_score: number | null = null;
    for (const c of competitionMeta.competitors ?? []) {
      const sc = parseScoreStr(c.score);
      if (c.homeAway === "home") home_score = sc;
      if (c.homeAway === "away") away_score = sc;
    }
    const { error: metaErr } = await supabase
      .from("games")
      .update({
        status,
        status_detail,
        home_score,
        away_score,
      })
      .eq("id", game.id);
    if (metaErr) {
      console.warn("[statSync] games metadata update: %s", metaErr.message);
    }
  }

  const boxPlayers = summary.boxscore?.players;
  const boxTeams = summary.boxscore?.teams;
  if (!boxPlayers?.length || !boxTeams?.length) {
    return {
      ok: false,
      error: "Missing boxscore.players or boxscore.teams",
      isFinalCompleted: false,
      gameId: game.id,
    };
  }

  const headerPoints = teamPointsFromHeader(summary);
  const teamIdByAbbr = new Map<string, string>();

  for (const side of boxTeams) {
    const t = side.team;
    if (!t?.abbreviation) continue;
    const tid = await ensureTeamId(supabase, leagueSlug, t);
    if (tid) teamIdByAbbr.set(t.abbreviation.trim(), tid);
  }

  for (const side of boxPlayers) {
    const t = side.team;
    if (!t?.abbreviation) continue;
    if (!teamIdByAbbr.has(t.abbreviation.trim())) {
      const tid = await ensureTeamId(supabase, leagueSlug, t);
      if (tid) teamIdByAbbr.set(t.abbreviation.trim(), tid);
    }
  }

  let plannedTeamUpserts = 0;
  for (const side of boxTeams) {
    const abbr = side.team?.abbreviation?.trim();
    if (!abbr) continue;
    if (teamIdByAbbr.get(abbr)) plannedTeamUpserts++;
  }

  let plannedPlayerUpserts = 0;
  for (const side of boxPlayers) {
    const abbr = side.team?.abbreviation?.trim();
    if (!abbr || !teamIdByAbbr.get(abbr)) continue;
    const blocks = BASEBALL_BOX_LEAGUES.has(leagueSlug) ? (side.statistics ?? []) : (side.statistics?.slice(0, 1) ?? []);
    const seen = new Set<string>();
    for (const block of blocks) {
      for (const ath of block.athletes ?? []) {
        const id = ath.athlete?.id ? String(ath.athlete.id) : null;
        if (!id || ath.didNotPlay || seen.has(id)) continue;
        seen.add(id);
        plannedPlayerUpserts++;
      }
    }
  }

  console.info(
    "[statSync] game_id=%s about to upsert game_team_stats rows=%s game_player_stats rows=%s",
    game.id,
    plannedTeamUpserts,
    plannedPlayerUpserts,
  );

  const teamStatRows: Record<string, Record<string, string>> = {};
  const mlbTotalsByAbbr = new Map<string, { batting: Record<string, string>; pitching: Record<string, string> }>();
  if (BASEBALL_BOX_LEAGUES.has(leagueSlug)) {
    for (const side of boxPlayers) {
      const abbr = side.team?.abbreviation?.trim();
      if (!abbr) continue;
      const rec = { batting: {}, pitching: {} } as { batting: Record<string, string>; pitching: Record<string, string> };
      for (const block of side.statistics ?? []) {
        const m = totalsByKey((block as { totals?: string[] }).totals, block.keys);
        const type = ((block as { type?: string }).type ?? "").toLowerCase();
        if (type === "batting") rec.batting = m;
        else if (type === "pitching") rec.pitching = m;
      }
      mlbTotalsByAbbr.set(abbr, rec);
    }
  }

  for (const side of boxTeams) {
    const abbr = side.team?.abbreviation?.trim();
    if (!abbr) continue;
    teamStatRows[abbr] = statMap(side.statistics);
  }

  for (const side of boxTeams) {
    const abbr = side.team?.abbreviation?.trim();
    if (!abbr) continue;
    const teamId = teamIdByAbbr.get(abbr);
    if (!teamId) continue;
    const sm = teamStatRows[abbr] ?? {};
    const row =
      BASKETBALL_BOX_LEAGUES.has(leagueSlug)
        ? (() => {
            const fg = parseMadeAttempted(sm["fieldGoalsMade-fieldGoalsAttempted"]);
            const tp = parseMadeAttempted(sm["threePointFieldGoalsMade-threePointFieldGoalsAttempted"]);
            const ft = parseMadeAttempted(sm["freeThrowsMade-freeThrowsAttempted"]);
            return {
              game_id: game.id,
              team_id: teamId,
              points: headerPoints.get(abbr) ?? null,
              fg_made: fg.made,
              fg_attempted: fg.attempted,
              three_made: tp.made,
              three_attempted: tp.attempted,
              ft_made: ft.made,
              ft_attempted: ft.attempted,
              offensive_rebounds: parseIntStat(sm["offensiveRebounds"]),
              defensive_rebounds: parseIntStat(sm["defensiveRebounds"]),
              total_rebounds: parseIntStat(sm["totalRebounds"]),
              assists: parseIntStat(sm["assists"]),
              steals: parseIntStat(sm["steals"]),
              blocks: parseIntStat(sm["blocks"]),
              turnovers: parseIntStat(sm["turnovers"] ?? sm["totalTurnovers"]),
              fast_break_points: parseIntStat(sm["fastBreakPoints"]),
              points_in_paint: parseIntStat(sm["pointsInPaint"]),
              second_chance_points: null as number | null,
              bench_points: null as number | null,
            };
          })()
        : HOCKEY_BOX_LEAGUES.has(leagueSlug)
          ? {
            // NHL mapping into existing schema columns; UI renders hockey labels for these fields.
            game_id: game.id,
            team_id: teamId,
            points: headerPoints.get(abbr) ?? null, // goals
            fg_made: parseIntStat(sm["shotsTotal"]), // shots
            fg_attempted: parseIntStat(sm["hits"]), // hits
            three_made: parseIntStat(sm["takeaways"]), // takeaways
            three_attempted: parseIntStat(sm["giveaways"]), // giveaways
            ft_made: parseIntStat(sm["powerPlayGoals"]), // PPG
            ft_attempted: parseIntStat(sm["powerPlayOpportunities"]), // PPO
            offensive_rebounds: parseIntStat(sm["faceoffsWon"]), // FOW
            defensive_rebounds: parseIntStat(sm["penalties"]), // penalties
            total_rebounds: parseIntStat(sm["penaltyMinutes"]), // PIM
            assists: parseIntStat(sm["blockedShots"]), // blocks
            steals: parseIntStat(sm["shortHandedGoals"]), // SHG
            blocks: parseIntStat(sm["shootoutGoals"]), // SO goals
            turnovers: parseNumberStat(sm["faceoffPercent"]) != null ? Math.round(parseNumberStat(sm["faceoffPercent"])!) : null, // FO%
            fast_break_points: null as number | null,
            points_in_paint: null as number | null,
            second_chance_points: null as number | null,
            bench_points: null as number | null,
          }
          : (() => {
              const m = mlbTotalsByAbbr.get(abbr) ?? { batting: {}, pitching: {} };
              const b = m.batting;
              const p = m.pitching;
              const pitchesStrikes = parseMadeAttempted(p["pitches-strikes"]);
              return {
                game_id: game.id,
                team_id: teamId,
                points: headerPoints.get(abbr) ?? parseIntStat(b["runs"]) ?? null, // runs
                fg_made: parseIntStat(b["hits"]), // hits
                fg_attempted: parseIntStat(b["atBats"]), // at-bats
                three_made: parseIntStat(b["homeRuns"]), // HR
                three_attempted: parseIntStat(b["walks"]), // BB
                ft_made: parseIntStat(b["RBIs"]), // RBI
                ft_attempted: parseIntStat(b["pitches"]), // pitches seen
                offensive_rebounds: parseIntStat(p["hits"]), // hits allowed
                defensive_rebounds: parseIntStat(p["runs"]), // runs allowed
                total_rebounds: parseIntStat(p["earnedRuns"]), // earned runs
                assists: parseIntStat(p["strikeouts"]), // strikeouts pitched
                steals: pitchesStrikes.attempted, // strikes
                blocks: parseIntStat(p["homeRuns"]), // HR allowed
                turnovers: parseIntStat(p["walks"]), // walks allowed
                fast_break_points: null as number | null,
                points_in_paint: null as number | null,
                second_chance_points: null as number | null,
                bench_points: null as number | null,
              };
            })();

    const { error } = await supabase.from("game_team_stats").upsert(row, { onConflict: "game_id,team_id" });
    if (error) {
      return { ok: false, error: `game_team_stats: ${error.message}`, isFinalCompleted, gameId: game.id };
    }
  }

  let playersUpserted = 0;

  for (const side of boxPlayers) {
    const abbr = side.team?.abbreviation?.trim();
    if (!abbr) continue;
    const teamId = teamIdByAbbr.get(abbr);
    if (!teamId) {
      return { ok: false, error: `No team_id for ${abbr}`, isFinalCompleted, gameId: game.id };
    }

    const statBlocks = BASEBALL_BOX_LEAGUES.has(leagueSlug) ? (side.statistics ?? []) : (side.statistics?.slice(0, 1) ?? []);
    const aggregated = new Map<
      string,
      {
        athlete: NonNullable<EspnAthleteWrap["athlete"]>;
        starter: boolean;
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
      }
    >();

    for (const statBlock of statBlocks) {
      const keys = statBlock?.keys ?? [];
      const athletes = statBlock?.athletes ?? [];
      const blockType = ((statBlock as { type?: string }).type ?? "").toLowerCase();
      for (const ath of athletes) {
      if (ath.didNotPlay || !ath.athlete?.id) continue;
      const athlete = ath.athlete;
      const externalId = String(athlete.id);
      const stats = ath.stats ?? [];
      const prev = aggregated.get(externalId) ?? {
        athlete,
        starter: Boolean(ath.starter),
        minutes: null,
        points: null,
        rebounds: null,
        assists: null,
        steals: null,
        blocks: null,
        turnovers: null,
        fouls: null,
        plus_minus: null,
        fg_made: null,
        fg_attempted: null,
        three_made: null,
        three_attempted: null,
        ft_made: null,
        ft_attempted: null,
      };

      const mapped =
        BASKETBALL_BOX_LEAGUES.has(leagueSlug)
          ? (() => {
              const min = statByKey(stats, keys, "minutes");
              const pts = statByKey(stats, keys, "points");
              const reb = statByKey(stats, keys, "rebounds");
              const ast = statByKey(stats, keys, "assists");
              const stl = statByKey(stats, keys, "steals");
              const blk = statByKey(stats, keys, "blocks");
              const tov = statByKey(stats, keys, "turnovers");
              const pf = statByKey(stats, keys, "fouls");
              const pm = statByKey(stats, keys, "plusMinus");
              const fg = parseMadeAttempted(statByKey(stats, keys, "fieldGoalsMade-fieldGoalsAttempted"));
              const tp = parseMadeAttempted(statByKey(stats, keys, "threePointFieldGoalsMade-threePointFieldGoalsAttempted"));
              const ft = parseMadeAttempted(statByKey(stats, keys, "freeThrowsMade-freeThrowsAttempted"));
              return {
                minutes: min && min !== "" ? min : null,
                points: parseIntStat(pts),
                rebounds: parseIntStat(reb),
                assists: parseIntStat(ast),
                steals: parseIntStat(stl),
                blocks: parseIntStat(blk),
                turnovers: parseIntStat(tov),
                fouls: parseIntStat(pf),
                plus_minus: parseIntStat(pm),
                fg_made: fg.made,
                fg_attempted: fg.attempted,
                three_made: tp.made,
                three_attempted: tp.attempted,
                ft_made: ft.made,
                ft_attempted: ft.attempted,
              };
            })()
          : HOCKEY_BOX_LEAGUES.has(leagueSlug)
            ? (() => {
              // NHL mapping into existing schema columns; UI renders hockey labels for these fields.
              const goals = parseIntStat(statByKey(stats, keys, "goals")) ?? 0;
              const assists = parseIntStat(statByKey(stats, keys, "assists")) ?? 0;
              return {
                minutes: statByKey(stats, keys, "timeOnIce") ?? null,
                points: goals + assists, // points
                rebounds: parseIntStat(statByKey(stats, keys, "shotsTotal")), // SOG
                assists: assists,
                steals: parseIntStat(statByKey(stats, keys, "takeaways")), // takeaways
                blocks: parseIntStat(statByKey(stats, keys, "blockedShots")), // blocks
                turnovers: parseIntStat(statByKey(stats, keys, "giveaways")), // giveaways
                fouls: parseIntStat(statByKey(stats, keys, "penaltyMinutes")), // PIM
                plus_minus: parseIntStat(statByKey(stats, keys, "plusMinus")),
                fg_made: goals, // goals
                fg_attempted: parseIntStat(statByKey(stats, keys, "shotsTotal")), // shots
                three_made: parseIntStat(statByKey(stats, keys, "hits")), // hits
                three_attempted: parseIntStat(statByKey(stats, keys, "faceoffsWon")), // FOW
                ft_made: parseIntStat(statByKey(stats, keys, "penalties")), // penalties
                ft_attempted: parseIntStat(statByKey(stats, keys, "shifts")), // shifts
              };
            })()
            : (() => {
                const pitchesStrikes = parseMadeAttempted(statByKey(stats, keys, "pitches-strikes"));
                if (blockType === "pitching") {
                  return {
                    minutes: statByKey(stats, keys, "fullInnings.partInnings") ?? null, // IP
                    points: parseIntStat(statByKey(stats, keys, "earnedRuns")), // ER
                    rebounds: parseIntStat(statByKey(stats, keys, "hits")), // H allowed
                    assists: parseIntStat(statByKey(stats, keys, "strikeouts")), // K
                    steals: parseIntStat(statByKey(stats, keys, "runs")), // R allowed
                    blocks: parseIntStat(statByKey(stats, keys, "homeRuns")), // HR allowed
                    turnovers: parseIntStat(statByKey(stats, keys, "walks")), // BB
                    fouls: parseIntStat(statByKey(stats, keys, "earnedRuns")), // ER
                    plus_minus: null,
                    fg_made: pitchesStrikes.attempted, // strikes
                    fg_attempted: parseIntStat(statByKey(stats, keys, "pitches")), // pitches
                    three_made: parseIntStat(statByKey(stats, keys, "strikeouts")), // K
                    three_attempted: parseIntStat(statByKey(stats, keys, "walks")), // BB
                    ft_made: parseIntStat(statByKey(stats, keys, "earnedRuns")), // ER
                    ft_attempted: parseIntStat(statByKey(stats, keys, "runs")), // R
                  };
                }
                const avg = parseNumberStat(statByKey(stats, keys, "avg"));
                const obp = parseNumberStat(statByKey(stats, keys, "onBasePct"));
                const slg = parseNumberStat(statByKey(stats, keys, "slugAvg"));
                return {
                  minutes: null,
                  points: parseIntStat(statByKey(stats, keys, "RBIs")), // RBI
                  rebounds: parseIntStat(statByKey(stats, keys, "hits")), // H
                  assists: parseIntStat(statByKey(stats, keys, "runs")), // R
                  steals: obp != null ? Math.round(obp * 1000) : null, // OBP (milli)
                  blocks: parseIntStat(statByKey(stats, keys, "strikeouts")), // K
                  turnovers: parseIntStat(statByKey(stats, keys, "walks")), // BB
                  fouls: slg != null ? Math.round(slg * 1000) : null, // SLG (milli)
                  plus_minus: avg != null ? Math.round(avg * 1000) : null, // AVG (milli)
                  fg_made: parseIntStat(statByKey(stats, keys, "hits")), // H
                  fg_attempted: parseIntStat(statByKey(stats, keys, "atBats")), // AB
                  three_made: parseIntStat(statByKey(stats, keys, "homeRuns")), // HR
                  three_attempted: parseIntStat(statByKey(stats, keys, "walks")), // BB
                  ft_made: parseIntStat(statByKey(stats, keys, "RBIs")), // RBI
                  ft_attempted: parseIntStat(statByKey(stats, keys, "pitches")), // pitches seen
                };
              })();

      aggregated.set(externalId, {
        athlete,
        starter: prev.starter || Boolean(ath.starter),
        minutes: mapped.minutes ?? prev.minutes,
        points: mapped.points ?? prev.points,
        rebounds: mapped.rebounds ?? prev.rebounds,
        assists: mapped.assists ?? prev.assists,
        steals: mapped.steals ?? prev.steals,
        blocks: mapped.blocks ?? prev.blocks,
        turnovers: mapped.turnovers ?? prev.turnovers,
        fouls: mapped.fouls ?? prev.fouls,
        plus_minus: mapped.plus_minus ?? prev.plus_minus,
        fg_made: mapped.fg_made ?? prev.fg_made,
        fg_attempted: mapped.fg_attempted ?? prev.fg_attempted,
        three_made: mapped.three_made ?? prev.three_made,
        three_attempted: mapped.three_attempted ?? prev.three_attempted,
        ft_made: mapped.ft_made ?? prev.ft_made,
        ft_attempted: mapped.ft_attempted ?? prev.ft_attempted,
      });
    }
    }

    for (const [externalId, agg] of Array.from(aggregated.entries())) {
      const displayName = agg.athlete.displayName ?? agg.athlete.shortName ?? "Player";
      const { data: playerRow, error: pErr } = await supabase
        .from("players")
        .upsert(
          {
            external_id: externalId,
            name: displayName,
            team_id: teamId,
            position: agg.athlete.position?.abbreviation ?? null,
            jersey_number: agg.athlete.jersey != null && agg.athlete.jersey !== "" ? String(agg.athlete.jersey) : null,
            headshot_url: agg.athlete.headshot?.href ?? null,
            is_active: true,
          },
          { onConflict: "external_id" },
        )
        .select("id")
        .single();

      if (pErr || !playerRow?.id) {
        return {
          ok: false,
          error: pErr ? `players: ${pErr.message}` : `Missing player id: ${externalId}`,
          isFinalCompleted,
          gameId: game.id,
        };
      }

      const playerId = playerRow.id as string;
      const gps = {
        game_id: game.id,
        player_id: playerId,
        team_id: teamId,
        minutes: agg.minutes,
        points: agg.points,
        rebounds: agg.rebounds,
        assists: agg.assists,
        steals: agg.steals,
        blocks: agg.blocks,
        turnovers: agg.turnovers,
        fouls: agg.fouls,
        plus_minus: agg.plus_minus,
        fg_made: agg.fg_made,
        fg_attempted: agg.fg_attempted,
        three_made: agg.three_made,
        three_attempted: agg.three_attempted,
        ft_made: agg.ft_made,
        ft_attempted: agg.ft_attempted,
        starter: agg.starter,
      };

      const { error: gErr } = await supabase.from("game_player_stats").upsert(gps, {
        onConflict: "game_id,player_id",
      });
      if (gErr) {
        return { ok: false, error: `game_player_stats: ${gErr.message}`, isFinalCompleted, gameId: game.id };
      }
      playersUpserted++;
    }
  }

  return {
    ok: true,
    isFinalCompleted,
    gameId: game.id,
    teamsUpserted: plannedTeamUpserts,
    playersUpserted,
  };
}

type EspnHeaderCompetitor = {
  homeAway?: string;
  team?: EspnBoxscoreTeam["team"];
};

type EspnRosterAthlete = {
  id?: string;
  displayName?: string;
  fullName?: string;
  jersey?: string;
  position?: { abbreviation?: string };
  headshot?: { href?: string };
  status?: { type?: string };
};

export type PregameRosterSyncResult = {
  ok: boolean;
  error?: string;
  skipped?: boolean;
  playersWritten?: number;
  teamRowsWritten?: number;
};

/**
 * When ESPN has no `boxscore.players` yet (pregame), upsert roster athletes into `players` + `game_player_stats`
 * with all stats zero so the UI shows full tables until the real box score sync replaces them.
 */
export async function syncPregameRosterZeros(
  supabase: SupabaseClient,
  gameId: string,
  externalId: string,
  league: string,
): Promise<PregameRosterSyncResult> {
  const leagueSlug = league.toLowerCase().trim();
  if (SKIP_LEAGUES.has(leagueSlug) || !BASKETBALL_BOX_LEAGUES.has(leagueSlug)) {
    return { ok: true, skipped: true, playersWritten: 0, teamRowsWritten: 0 };
  }

  const path = getEspnLeaguePath(leagueSlug);
  if (!path) {
    return { ok: false, error: `Unknown league: ${league}` };
  }

  const candidates = getEspnSummaryUrls(path, externalId, leagueSlug);
  const fetched = await fetchSummaryFromCandidates(candidates);
  if (!fetched.ok) {
    return { ok: false, error: fetched.error ?? "ESPN summary fetch failed" };
  }
  const summary = parseEspnSummaryFromBody(fetched.bodyText);
  if (!summary) {
    return { ok: false, error: "Invalid ESPN JSON" };
  }

  const boxPlayers = summary.boxscore?.players;
  if (Array.isArray(boxPlayers) && boxPlayers.length > 0) {
    const first = boxPlayers[0] as { statistics?: { athletes?: unknown[] }[] };
    const n = first?.statistics?.[0]?.athletes?.length ?? 0;
    if (n > 0) {
      return { ok: true, skipped: true, playersWritten: 0, teamRowsWritten: 0 };
    }
  }

  const comps = summary.header?.competitions?.[0]?.competitors as EspnHeaderCompetitor[] | undefined;
  const bySide = new Map<string, EspnHeaderCompetitor>();
  for (const c of comps ?? []) {
    if (c.homeAway === "home" || c.homeAway === "away") {
      bySide.set(c.homeAway, c);
    }
  }
  const homeC = bySide.get("home");
  const awayC = bySide.get("away");
  const homeTeamEspn = homeC?.team;
  const awayTeamEspn = awayC?.team;
  if (!homeTeamEspn?.abbreviation || !awayTeamEspn?.abbreviation || !homeTeamEspn.id || !awayTeamEspn.id) {
    return { ok: false, error: "Missing header competitors for home/away" };
  }

  const headerPts = teamPointsFromHeader(summary);
  const homeAbbr = homeTeamEspn.abbreviation.trim();
  const awayAbbr = awayTeamEspn.abbreviation.trim();

  const homeDbId = await ensureTeamId(supabase, leagueSlug, homeTeamEspn);
  const awayDbId = await ensureTeamId(supabase, leagueSlug, awayTeamEspn);
  if (!homeDbId || !awayDbId) {
    return { ok: false, error: "Could not resolve team rows for roster sync" };
  }

  const zeroTeamRow = (teamId: string, abbr: string) => ({
    game_id: gameId,
    team_id: teamId,
    points: headerPts.get(abbr) ?? 0,
    fg_made: 0,
    fg_attempted: 0,
    three_made: 0,
    three_attempted: 0,
    ft_made: 0,
    ft_attempted: 0,
    offensive_rebounds: 0,
    defensive_rebounds: 0,
    total_rebounds: 0,
    assists: 0,
    steals: 0,
    blocks: 0,
    turnovers: 0,
    fast_break_points: 0,
    points_in_paint: 0,
    second_chance_points: null as number | null,
    bench_points: null as number | null,
  });

  const { error: thErr } = await supabase.from("game_team_stats").upsert(zeroTeamRow(homeDbId, homeAbbr), {
    onConflict: "game_id,team_id",
  });
  if (thErr) {
    return { ok: false, error: `game_team_stats (home): ${thErr.message}` };
  }
  const { error: taErr } = await supabase.from("game_team_stats").upsert(zeroTeamRow(awayDbId, awayAbbr), {
    onConflict: "game_id,team_id",
  });
  if (taErr) {
    return { ok: false, error: `game_team_stats (away): ${taErr.message}` };
  }

  const rosterUrl = (espnTeamId: string) =>
    `${getEspnBaseUrl()}/${path}/teams/${encodeURIComponent(espnTeamId)}/roster`;

  const fetchRoster = async (espnTeamId: string): Promise<EspnRosterAthlete[]> => {
    const r = await fetchNoStoreWithTimeout(rosterUrl(espnTeamId));
    if (!r.ok) return [];
    const j = (await r.json()) as { athletes?: EspnRosterAthlete[] };
    return j.athletes ?? [];
  };

  const homeAthletes = await fetchRoster(String(homeTeamEspn.id));
  const awayAthletes = await fetchRoster(String(awayTeamEspn.id));
  if (homeAthletes.length === 0 && awayAthletes.length === 0) {
    return { ok: false, error: "ESPN rosters returned no athletes" };
  }

  const zeroGps = (playerId: string, teamId: string) => ({
    game_id: gameId,
    player_id: playerId,
    team_id: teamId,
    minutes: "0",
    points: 0,
    rebounds: 0,
    assists: 0,
    steals: 0,
    blocks: 0,
    turnovers: 0,
    fouls: 0,
    plus_minus: 0,
    fg_made: 0,
    fg_attempted: 0,
    three_made: 0,
    three_attempted: 0,
    ft_made: 0,
    ft_attempted: 0,
    starter: false,
  });

  let playersWritten = 0;

  const writeSide = async (athletes: EspnRosterAthlete[], teamId: string) => {
    for (const a of athletes) {
      if (a.status?.type && a.status.type !== "active") continue;
      const ext = a.id != null ? String(a.id) : null;
      if (!ext) continue;
      const displayName = a.displayName ?? a.fullName ?? "Player";
      const { data: playerRow, error: pErr } = await supabase
        .from("players")
        .upsert(
          {
            external_id: ext,
            name: displayName,
            team_id: teamId,
            position: a.position?.abbreviation ?? null,
            jersey_number: a.jersey != null && a.jersey !== "" ? String(a.jersey) : null,
            headshot_url: a.headshot?.href ?? null,
            is_active: true,
          },
          { onConflict: "external_id" },
        )
        .select("id")
        .single();

      if (pErr || !playerRow?.id) {
        return pErr ? `players: ${pErr.message}` : `Missing player id: ${ext}`;
      }

      const { error: gErr } = await supabase.from("game_player_stats").upsert(zeroGps(playerRow.id as string, teamId), {
        onConflict: "game_id,player_id",
      });
      if (gErr) {
        return `game_player_stats: ${gErr.message}`;
      }
      playersWritten++;
    }
    return null;
  };

  const e1 = await writeSide(homeAthletes, homeDbId);
  if (e1) {
    return { ok: false, error: e1 };
  }
  const e2 = await writeSide(awayAthletes, awayDbId);
  if (e2) {
    return { ok: false, error: e2 };
  }

  return { ok: true, playersWritten, teamRowsWritten: 2 };
}
