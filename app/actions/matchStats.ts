"use server";

import { unstable_noStore } from "next/cache";

import { loadMatchStatsBundle } from "@/lib/match-stats/loadMatchStats";
import type { MatchStatsBundle } from "@/lib/match-stats/types";
import { tryCreateClient } from "@/lib/supabase/server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Per-game soccer-style match stats for `/game/[id]` (poll from client). */
export async function fetchMatchStatsBundle(gameId: string): Promise<MatchStatsBundle | null> {
  unstable_noStore();
  if (!UUID_RE.test(gameId)) {
    return null;
  }
  const supabase = tryCreateClient();
  if (!supabase) {
    return null;
  }
  try {
    return await loadMatchStatsBundle(supabase, gameId);
  } catch (e) {
    console.error("[fetchMatchStatsBundle]", e);
    return null;
  }
}
