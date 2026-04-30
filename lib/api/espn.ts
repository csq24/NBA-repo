export type GameStatusKind = "live" | "final" | "scheduled";

/** Normalized row aligned with `public.games` plus UI fields (logos, status_kind). */
export type Game = {
  id: string;
  league: string;
  home_team: string;
  away_team: string;
  home_abbr: string | null;
  away_abbr: string | null;
  home_score: number | null;
  away_score: number | null;
  status: string;
  start_time: string;
  external_id: string;
  home_logo_url: string | null;
  away_logo_url: string | null;
  venue: string | null;
  status_kind: GameStatusKind;
};

export type LeagueOption = {
  label: string;
  slug: string;
};

/** UI league switcher entries (slug is passed to `fetchGames`). */
export const LEAGUES: readonly LeagueOption[] = [
  { label: "NBA", slug: "nba" },
  { label: "NHL", slug: "nhl" },
  { label: "MLB", slug: "mlb" },
  { label: "CBB", slug: "college-basketball" },
  { label: "FC", slug: "soccer-mls" },
  { label: "UFC", slug: "ufc" },
  { label: "Golf", slug: "golf-pga" },
  { label: "NFL", slug: "nfl" },
] as const;

const base =
  process.env.NEXT_PUBLIC_ESPN_BASE_URL?.replace(/\/$/, "") ??
  "https://site.api.espn.com/apis/site/v2/sports";

/** ESPN Site API base URL (no trailing slash). */
export function getEspnBaseUrl(): string {
  return base;
}

/** App slug → ESPN Site API path `{sport}/{league}` (scoreboard, summary, etc.). */
const LEAGUE_TO_ESPN_PATH: Record<string, string> = {
  nba: "basketball/nba",
  nfl: "football/nfl",
  nhl: "hockey/nhl",
  mlb: "baseball/mlb",
  "college-basketball": "basketball/mens-college-basketball",
  "soccer-mls": "soccer/usa.1",
  ufc: "mma/ufc",
  "golf-pga": "golf/pga",
};

/** Resolve app league slug to ESPN `{sport}/{league}` path, or `null` if unknown. */
export function getEspnLeaguePath(slug: string): string | null {
  const key = slug.toLowerCase().trim();
  return LEAGUE_TO_ESPN_PATH[key] ?? null;
}

function getEspnCoreLeagueCandidates(slug: string): string[] {
  const key = slug.toLowerCase().trim();
  if (key === "nba") return ["nba"];
  if (key === "college-basketball") return ["ncaab", "mens-college-basketball"];
  return [];
}

/**
 * Candidate summary URLs (ordered) based on public ESPN endpoint patterns.
 * Primary remains `site.api`; `site.web.api` is a useful fallback for fresher payloads.
 */
export function getEspnSummaryUrls(path: string, eventId: string, leagueSlug?: string): string[] {
  const safePath = path.replace(/^\/+/, "");
  const safeEventId = encodeURIComponent(eventId);
  const primaryBase = getEspnBaseUrl();
  const siteWebBase = "https://site.web.api.espn.com/apis/site/v2/sports";
  const urls = [
    `${primaryBase}/${safePath}/summary?event=${safeEventId}`,
    `${siteWebBase}/${safePath}/summary?event=${safeEventId}&region=us&lang=en&contentorigin=espn`,
  ];

  for (const coreLeague of getEspnCoreLeagueCandidates(leagueSlug ?? "")) {
    urls.push(`https://cdn.espn.com/core/${coreLeague}/game?xhr=1&gameId=${safeEventId}`);
  }

  return urls;
}

type EspnCompetitor = {
  homeAway?: string;
  score?: string;
  team?: {
    displayName?: string;
    shortDisplayName?: string;
    name?: string;
    abbreviation?: string;
    logo?: string;
  };
};

type EspnCompetition = {
  date?: string;
  venue?: {
    fullName?: string;
  };
  competitors?: EspnCompetitor[];
};

type EspnEvent = {
  id: string;
  date?: string;
  name?: string;
  competitions?: EspnCompetition[];
  status?: {
    type?: {
      name?: string;
      shortDetail?: string;
      detail?: string;
      description?: string;
      state?: string;
      completed?: boolean;
    };
  };
};

type EspnScoreboardResponse = {
  events?: EspnEvent[];
};

function parseScore(raw: string | undefined): number | null {
  if (raw === undefined || raw === "") return null;
  const n = Number.parseInt(raw, 10);
  return Number.isNaN(n) ? null : n;
}

function pickStatus(event: EspnEvent): string {
  const t = event.status?.type;
  return (
    t?.shortDetail ??
    t?.detail ??
    t?.description ??
    t?.name ??
    t?.state ??
    "Unknown"
  );
}

/** Map DB phase (`games.status`) or ESPN label to UI `status_kind`. */
export function statusKindFromDbStatus(status: string): GameStatusKind {
  const phase = status.toLowerCase().trim();
  if (phase === "final") return "final";
  if (phase === "in_progress") return "live";
  if (phase === "scheduled") return "scheduled";

  const s = status.toUpperCase();
  if (s.includes("FINAL") || s.includes("OFFICIAL") || /\bFT\b/.test(s)) return "final";
  if (
    s.includes("LIVE") ||
    s.includes("HALF") ||
    s.includes("QTR") ||
    s.includes("END ") ||
    s.includes(" OT") ||
    s.includes("IN PROGRESS") ||
    s.includes("DELAY") ||
    s.includes("HALFTIME")
  ) {
    return "live";
  }
  return "scheduled";
}

/** Value stored in `public.games.status` when syncing from ESPN scoreboard. */
export function canonicalGameStatusFromKind(kind: GameStatusKind): "in_progress" | "final" | "scheduled" {
  if (kind === "live") return "in_progress";
  if (kind === "final") return "final";
  return "scheduled";
}

function statusKind(event: EspnEvent): GameStatusKind {
  const t = event.status?.type;
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

function normalizeEvent(event: EspnEvent, leagueSlug: string): Game | null {
  const competition = event.competitions?.[0];
  if (!competition?.competitors?.length) return null;

  const bySide = new Map<string, EspnCompetitor>();
  for (const c of competition.competitors) {
    const side = c.homeAway;
    if (side === "home" || side === "away") bySide.set(side, c);
  }

  const home = bySide.get("home");
  const away = bySide.get("away");
  if (!home || !away) return null;

  const homeName =
    home.team?.displayName ??
    home.team?.shortDisplayName ??
    home.team?.name ??
    "Home";
  const awayName =
    away.team?.displayName ??
    away.team?.shortDisplayName ??
    away.team?.name ??
    "Away";

  const start =
    competition.date ?? event.date ?? new Date(0).toISOString();

  return {
    id: globalThis.crypto.randomUUID(),
    league: leagueSlug,
    home_team: homeName,
    away_team: awayName,
    home_abbr: home.team?.abbreviation ?? null,
    away_abbr: away.team?.abbreviation ?? null,
    home_score: parseScore(home.score),
    away_score: parseScore(away.score),
    status: pickStatus(event),
    start_time: start,
    external_id: String(event.id),
    home_logo_url: home.team?.logo ?? null,
    away_logo_url: away.team?.logo ?? null,
    venue: competition.venue?.fullName ?? null,
    status_kind: statusKind(event),
  };
}

const DEFAULT_ESPN_TIMEOUT_MS = 18_000;

function espnDateYmd(date: Date, timeZone = "America/New_York"): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}${m}${d}`;
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal, next: { revalidate: 60 } });
  } catch (e) {
    const name = e instanceof Error ? e.name : "";
    if (name === "AbortError") {
      throw new Error(`ESPN scoreboard request timed out after ${timeoutMs}ms (${url})`);
    }
    throw e;
  } finally {
    clearTimeout(id);
  }
}

export type FetchGamesOptions = {
  /** Abort hanging scoreboard requests (firewalls, DNS, etc.). */
  timeoutMs?: number;
  /** ESPN scoreboard day in YYYYMMDD (ET). */
  dateYmd?: string;
};

/**
 * Fetches today's scoreboard from ESPN and maps events to `Game` rows.
 * For `ufc`, returns `null` if the scoreboard request fails (path/API unavailable).
 *
 * **Server-only in practice:** do not call this from Client Components (ESPN CORS).
 * From the browser, import and call `fetchGames` from `@/app/actions/scoreboard` instead;
 * that server action delegates here.
 */
export async function fetchGames(league: string, options?: FetchGamesOptions): Promise<Game[] | null> {
  const slug = league.toLowerCase().trim();
  const path = LEAGUE_TO_ESPN_PATH[slug];
  if (!path) {
    throw new Error(`Unknown league slug: ${league}`);
  }

  const timeoutMs = options?.timeoutMs ?? DEFAULT_ESPN_TIMEOUT_MS;
  const fallbackYmd = espnDateYmd(new Date());
  const dateYmd = options?.dateYmd ?? fallbackYmd;
  const url = `${getEspnBaseUrl()}/${path}/scoreboard?dates=${dateYmd}`;
  let res: Response;
  try {
    res = await fetchWithTimeout(url, timeoutMs);
  } catch (e) {
    if (slug === "ufc") return null;
    const msg = e instanceof Error ? e.message : "Network error";
    throw new Error(
      msg.includes("timeout") || msg.includes("timed out")
        ? msg
        : `Failed to fetch ESPN scoreboard for ${slug}: ${msg}`,
    );
  }

  if (!res.ok) {
    if (slug === "ufc") return null;
    throw new Error(`ESPN scoreboard error (${res.status}): ${url}`);
  }

  let data: EspnScoreboardResponse;
  try {
    data = (await res.json()) as EspnScoreboardResponse;
  } catch (e) {
    if (slug === "ufc") return null;
    const msg = e instanceof Error ? e.message : "Invalid JSON";
    throw new Error(`ESPN scoreboard returned unreadable JSON for ${slug}: ${msg}`);
  }
  const events = data.events ?? [];

  const games: Game[] = [];
  for (const event of events) {
    if (!event?.id) continue;
    const row = normalizeEvent(event, slug);
    if (row) games.push(row);
  }

  return games;
}
