"use server";

import { unstable_noStore } from "next/cache";

import { loadGameBoxscore } from "@/lib/game/loadGameBoxscore";
import type { GameBoxscoreSnapshot } from "@/lib/game/types";
import { tryCreateClient } from "@/lib/supabase/server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Latest game row + team/player box score for `/game/[id]` polling.
 * Pass the Supabase `games.id` (UUID), not the ESPN `external_id`.
 */
export async function fetchGameSnapshot(gameId: string): Promise<GameBoxscoreSnapshot | null> {
  unstable_noStore();
  if (!UUID_RE.test(gameId)) {
    return null;
  }
  const supabase = tryCreateClient();
  if (!supabase) {
    return null;
  }
  try {
    return await loadGameBoxscore(supabase, gameId);
  } catch (e) {
    console.error("[fetchGameSnapshot]", e);
    return null;
  }
}
