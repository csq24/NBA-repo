"use client";

import { useCallback, useEffect, useState } from "react";

import { fetchGameSnapshot } from "@/app/actions/gameSnapshot";
import { GameScoreboardHeader } from "@/components/GameScoreboardHeader";
import { GameStatSheets } from "@/components/game/GameStatSheets";
import { MatchStatsTabs } from "@/components/game/MatchStatsTabs";
import { tryCreateClient } from "@/lib/supabase/client";
import type { GameBoxscoreSnapshot } from "@/lib/game/types";
import type { MatchStatsBundle } from "@/lib/match-stats/types";
import type { GameRow } from "@/types/thread";

function snapshotToGameRow(s: GameBoxscoreSnapshot["game"]): GameRow {
  return {
    id: s.id,
    league: s.league,
    home_team: s.home_team,
    away_team: s.away_team,
    home_score: s.home_score,
    away_score: s.away_score,
    status: s.status,
    status_detail: s.status_detail,
    start_time: s.start_time,
    external_id: s.external_id,
    stats_synced: s.stats_synced,
  };
}

function pollIntervalMs(status: string, statsSynced: boolean | null | undefined): number {
  if (status === "in_progress") return 12_000;
  if (status === "final" && !statsSynced) return 20_000;
  return 60_000;
}

type GameLivePanelProps = {
  gameId: string;
  initialGame: GameRow;
  initialSnapshot: GameBoxscoreSnapshot | null;
  initialMatchStats: MatchStatsBundle;
};

export function GameLivePanel({ gameId, initialGame, initialSnapshot, initialMatchStats }: GameLivePanelProps) {
  const [snap, setSnap] = useState<GameBoxscoreSnapshot | null>(initialSnapshot);

  const headerGame: GameRow = snap ? snapshotToGameRow(snap.game) : initialGame;

  const tick = useCallback(async () => {
    try {
      const next = await fetchGameSnapshot(gameId);
      if (next) {
        setSnap(next);
      }
    } catch (e) {
      console.warn("[GameLivePanel] snapshot refresh failed", e);
    }
  }, [gameId]);

  useEffect(() => {
    void tick();
  }, [tick]);

  const status = snap?.game.status ?? initialGame.status;
  const statsSynced = snap?.game.stats_synced ?? initialGame.stats_synced ?? null;
  const pollMs = pollIntervalMs(status, statsSynced);

  useEffect(() => {
    const id = setInterval(() => {
      void tick();
    }, pollMs);
    return () => clearInterval(id);
  }, [tick, pollMs]);

  useEffect(() => {
    const supabase = tryCreateClient();
    if (!supabase) return;

    type GamesRow = {
      id: string;
      home_score: number | null;
      away_score: number | null;
      status: string;
      status_detail: string | null;
      home_team: string;
      away_team: string;
      start_time: string;
      league: string;
    };

    const channel = supabase
      .channel(`game-row-${gameId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "games",
          filter: `id=eq.${gameId}`,
        },
        (payload) => {
          const row = payload.new as GamesRow & { stats_synced?: boolean | null };
          if (!row?.id) return;
          setSnap((prev) => {
            if (!prev) {
              queueMicrotask(() => {
                void tick();
              });
              return prev;
            }
            return {
              ...prev,
              game: {
                ...prev.game,
                home_score: row.home_score,
                away_score: row.away_score,
                status: row.status,
                status_detail: row.status_detail,
                home_team: row.home_team,
                away_team: row.away_team,
                start_time: row.start_time,
                league: row.league,
                stats_synced: row.stats_synced ?? prev.game.stats_synced,
              },
            };
          });
        },
      )
      .subscribe((status, err) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn("[game realtime]", status, err?.message ?? err);
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [gameId, initialGame.external_id, tick]);

  return (
    <>
      <GameScoreboardHeader game={headerGame} />
      <GameStatSheets snapshot={snap} />
      <MatchStatsTabs gameId={gameId} initial={initialMatchStats} />
    </>
  );
}
