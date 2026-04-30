"use server";

import { unstable_noStore } from "next/cache";

import type { Game } from "@/lib/api/espn";
import { canonicalGameStatusFromKind, fetchGames as fetchGamesFromEspn } from "@/lib/api/espn";
import { getSupabaseEnvDiagnostics } from "@/lib/supabase/env";
import { tryCreateClient } from "@/lib/supabase/server";

const ESPN_TIMEOUT_MS = 18_000;
const SUPABASE_UPSERT_TIMEOUT_MS = 12_000;

function gameToDbRow(g: Game) {
  return {
    league: g.league,
    home_team: g.home_team,
    away_team: g.away_team,
    home_score: g.home_score,
    away_score: g.away_score,
    status: canonicalGameStatusFromKind(g.status_kind),
    status_detail: g.status,
    start_time: g.start_time,
    external_id: g.external_id,
  };
}

/**
 * ESPN scoreboard for Client Components and other callers that run in the browser.
 * Delegates to `@/lib/api/espn` — use **this** `fetchGames`, not `@/lib/api/espn`, from `"use client"` modules.
 */
export async function fetchGames(league: string, dateYmd?: string) {
  unstable_noStore();
  return fetchGamesFromEspn(league, { timeoutMs: ESPN_TIMEOUT_MS, dateYmd });
}

/** Safe for the client: whether Supabase public env validates (no keys returned). */
export async function getScoreboardSupabaseHealth(): Promise<{
  supabaseReady: boolean;
  urlHost: string | null;
  hints: string[];
}> {
  unstable_noStore();
  const d = getSupabaseEnvDiagnostics();
  if (d.ready) {
    console.info("[scoreboard] Supabase public env OK · host=%s", d.urlHost ?? "?");
  } else {
    console.warn("[scoreboard] Supabase public env missing or invalid:\n  - %s", d.hints.join("\n  - "));
  }
  return { supabaseReady: d.ready, urlHost: d.urlHost, hints: d.hints };
}

/**
 * Same as `fetchGames`, then upserts rows into `public.games` on `external_id`
 * so `/game/[id]` works for home-page links without a separate sync job.
 * Skips DB work when Supabase env is missing (still returns ESPN games).
 */
export async function fetchGamesWithSupabaseSync(league: string, dateYmd?: string) {
  unstable_noStore();
  const diag = getSupabaseEnvDiagnostics();
  if (diag.ready) {
    console.info("[fetchGamesWithSupabaseSync] Supabase client available · %s", diag.urlHost ?? "host?");
  } else {
    console.warn(
      "[fetchGamesWithSupabaseSync] Supabase skipped (env): %s",
      diag.hints.join(" · "),
    );
  }

  const slug = league.toLowerCase().trim();
  console.info("[fetchGamesWithSupabaseSync] Fetching ESPN · league=%s", slug);

  let games: Game[] | null;
  try {
    games = await fetchGamesFromEspn(league, { timeoutMs: ESPN_TIMEOUT_MS, dateYmd });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[fetchGamesWithSupabaseSync] ESPN fetch failed · league=%s · %s", slug, msg);
    throw e;
  }

  if (games == null) {
    console.warn("[fetchGamesWithSupabaseSync] ESPN returned null · league=%s (treated as empty)", slug);
    return [];
  }
  if (games.length === 0) {
    console.info("[fetchGamesWithSupabaseSync] ESPN returned 0 games · league=%s", slug);
    return [];
  }

  console.info("[fetchGamesWithSupabaseSync] ESPN OK · league=%s · games=%d", slug, games.length);

  const supabase = tryCreateClient();
  if (!supabase) {
    return games;
  }

  const upsert = supabase.from("games").upsert(games.map(gameToDbRow), { onConflict: "external_id" });
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Supabase games upsert timed out after ${SUPABASE_UPSERT_TIMEOUT_MS}ms`));
    }, SUPABASE_UPSERT_TIMEOUT_MS);
  });

  try {
    const { error } = await Promise.race([upsert, timeout]);
    if (error) {
      console.error("[fetchGamesWithSupabaseSync] Supabase upsert error:", error.message, error.code ?? "");
    } else {
      console.info("[fetchGamesWithSupabaseSync] Supabase upsert OK · rows=%d", games.length);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[fetchGamesWithSupabaseSync] Supabase upsert failed:", msg);
  }

  return games;
}
