import { NextResponse } from "next/server";

import { syncGameStats, syncPregameRosterZeros, type SyncGameStatsResult } from "@/lib/services/statSync";
import { tryCreateServiceRoleClient } from "@/lib/supabase/serviceRole";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Vercel Cron `schedule` is 5-field (minute granularity, UTC). There is no supported
 * “every 30 seconds” expression. This project uses `* * * * *` (~once per minute). For
 * true 30s polling, use an external scheduler calling this URL with the same auth.
 */
function verifyCronRequest(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

type GameRow = {
  id: string;
  external_id: string;
  league: string;
  status: string;
  stats_synced: boolean | null;
};

type PerGameResult = {
  ok: boolean;
  gameId: string;
  externalId?: string;
  teamsUpserted?: number;
  playersUpserted?: number;
  skipped?: boolean;
  stats_synced?: boolean;
  error?: string;
};

function summarizeSync(sync: SyncGameStatsResult): Pick<
  PerGameResult,
  "ok" | "teamsUpserted" | "playersUpserted" | "skipped" | "error"
> {
  return {
    ok: sync.ok,
    teamsUpserted: sync.teamsUpserted ?? 0,
    playersUpserted: sync.playersUpserted ?? 0,
    skipped: sync.skipped,
    error: sync.error,
  };
}

export async function GET(req: Request) {
  try {
    if (!verifyCronRequest(req)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    const serviceKeyConfigured = Boolean(serviceKey);
    console.info(
      "[sync-boxscore] SUPABASE_SERVICE_ROLE_KEY configured=%s length=%s (service-role client uses this key, not anon)",
      serviceKeyConfigured,
      serviceKey ? String(serviceKey.length) : 0,
    );

    const supabase = tryCreateServiceRoleClient();
    if (!supabase) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Missing service client: set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY.",
          serviceKeyConfigured,
        },
        { status: 503 },
      );
    }

    const url = new URL(req.url);
    const reconcile = url.searchParams.get("reconcile") === "1";

    let targets: GameRow[] = [];
    let qErr: { message: string } | null = null;

    if (reconcile) {
      const q = await supabase
        .from("games")
        .select("id, external_id, league, status, stats_synced")
        .gte("start_time", new Date(Date.now() - 7 * 86400_000).toISOString())
        .eq("status", "final")
        .eq("stats_synced", false);
      qErr = q.error;
      targets = (q.data ?? []) as GameRow[];
    } else {
      /** Live + recent final-unsynced + near-term scheduled preview window. */
      const inProgress = await supabase
        .from("games")
        .select("id, external_id, league, status, stats_synced")
        .eq("status", "in_progress");
      if (inProgress.error) {
        qErr = inProgress.error;
      } else {
        const finalUnsynced = await supabase
          .from("games")
          .select("id, external_id, league, status, stats_synced")
          .eq("status", "final")
          .gte("start_time", new Date(Date.now() - 7 * 86400_000).toISOString())
          .eq("stats_synced", false);
        if (finalUnsynced.error) {
          qErr = finalUnsynced.error;
        }

        // Scheduled preview: track upcoming slate (e.g. rest of playoff round).
        const schedFrom = new Date(Date.now()).toISOString();
        const schedTo = new Date(Date.now() + 14 * 24 * 3600_000).toISOString();
        const scheduled = await supabase
          .from("games")
          .select("id, external_id, league, status, stats_synced")
          .eq("status", "scheduled")
          .gte("start_time", schedFrom)
          .lte("start_time", schedTo);
        if (scheduled.error || qErr) {
          qErr = scheduled.error;
        } else {
          const byId = new Map<string, GameRow>();
          for (const r of (inProgress.data ?? []) as GameRow[]) {
            byId.set(r.id, r);
          }
          for (const r of (finalUnsynced.data ?? []) as GameRow[]) {
            byId.set(r.id, r);
          }
          for (const r of (scheduled.data ?? []) as GameRow[]) {
            byId.set(r.id, r);
          }
          targets = Array.from(byId.values());
        }
      }
    }

    if (qErr) {
      return NextResponse.json({ ok: false, error: qErr.message }, { status: 500 });
    }
    const results: PerGameResult[] = [];
    let totalTeams = 0;
    let totalPlayers = 0;

    for (const game of targets) {
      const sync = await syncGameStats(supabase, game.id, game.external_id);
      const base: PerGameResult = {
        gameId: game.id,
        externalId: game.external_id,
        ...summarizeSync(sync),
      };

      if (!sync.ok) {
        // For upcoming basketball games, write pregame roster zero rows so the game page
        // can render a full "blank state" stat sheet before tipoff.
        if (game.status === "scheduled") {
          const pre = await syncPregameRosterZeros(supabase, game.id, game.external_id, game.league);
          if (pre.ok) {
            const teams = pre.teamRowsWritten ?? 0;
            const players = pre.playersWritten ?? 0;
            totalTeams += teams;
            totalPlayers += players;
            results.push({
              gameId: game.id,
              externalId: game.external_id,
              ok: true,
              teamsUpserted: teams,
              playersUpserted: players,
              skipped: pre.skipped,
            });
            continue;
          }
        }
        results.push(base);
        continue;
      }

      if (sync.skipped) {
        results.push(base);
        continue;
      }

      totalTeams += sync.teamsUpserted ?? 0;
      totalPlayers += sync.playersUpserted ?? 0;

      if (sync.isFinalCompleted) {
        const { error: uErr } = await supabase.from("games").update({ stats_synced: true }).eq("id", game.id);
        if (uErr) {
          results.push({
            ...base,
            ok: false,
            error: `stats_synced update: ${uErr.message}`,
          });
          continue;
        }
        results.push({ ...base, ok: true, stats_synced: true });
      } else {
        results.push({ ...base, ok: true });
      }
    }

    const allOk = results.every((r) => r.ok);
    return NextResponse.json({
      ok: allOk,
      mode: reconcile ? "reconcile" : "live",
      scanned: targets.length,
      processed: targets.length,
      teamsUpserted: totalTeams,
      playersUpserted: totalPlayers,
      serviceKeyConfigured,
      results,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? e.stack : undefined;
    console.error("[sync-boxscore] unhandled error:", message, stack);
    return NextResponse.json(
      {
        ok: false,
        error: message,
        ...(process.env.NODE_ENV !== "production" && stack ? { stack } : {}),
      },
      { status: 500 },
    );
  }
}
