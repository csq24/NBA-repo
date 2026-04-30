"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { fetchGamesWithSupabaseSync, getScoreboardSupabaseHealth } from "@/app/actions/scoreboard";
import { LEAGUES, type Game } from "@/lib/api/espn";
import { GameCard } from "@/components/GameCard";
import { GameCardSkeleton } from "@/components/GameCardSkeleton";
import { LeagueSwitcher } from "@/components/LeagueSwitcher";

const DEFAULT_LEAGUE = LEAGUES[0]?.slug ?? "nba";

/** Fails the outer promise if the server action hangs (network / dev server issues). */
const CLIENT_SCOREBOARD_TIMEOUT_MS = 25_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms / 1000}s. Check the terminal running "npm run dev" and your network.`));
    }, ms);
    promise
      .then((v) => {
        clearTimeout(t);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(t);
        reject(e);
      });
  });
}

export default function HomePage() {
  const [league, setLeague] = useState(DEFAULT_LEAGUE);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [supabaseHint, setSupabaseHint] = useState<string | null>(null);
  const cacheRef = useRef<Map<string, Game[]>>(new Map());

  const weekDays = useMemo(() => {
    const days: Date[] = [];
    for (let i = 6; i >= 0; i--) {
      days.push(new Date(Date.now() - i * 24 * 3600_000));
    }
    // Extend forward so upcoming playoff games remain visible without waiting for "tomorrow".
    for (let i = 1; i <= 14; i++) {
      days.push(new Date(Date.now() + i * 24 * 3600_000));
    }
    return days;
  }, []);

  const dateKey = useMemo(() => {
    const f = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(selectedDate);
    return f.replaceAll("-", "");
  }, [selectedDate]);

  const cacheKey = `${league}:${dateKey}`;

  useEffect(() => {
    try {
      const raw = localStorage.getItem("score-cache-v1");
      if (!raw) return;
      const obj = JSON.parse(raw) as Record<string, Game[]>;
      for (const [k, v] of Object.entries(obj)) {
        cacheRef.current.set(k, v);
      }
    } catch {
      // ignore bad cache
    }
  }, []);

  useEffect(() => {
    void getScoreboardSupabaseHealth().then((h) => {
      if (!h.supabaseReady) {
        const text = h.hints.join(" ");
        console.warn("[scoreboard] Supabase not ready — ESPN may still work, but games will not persist:", h.hints);
        setSupabaseHint(text);
      } else {
        console.info("[scoreboard] Supabase OK ·", h.urlHost ?? "connected");
        setSupabaseHint(null);
      }
    });
  }, []);

  const refresh = useCallback(async (slug: string, ymd: string, options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    if (!silent) {
      setLoading(true);
    }
    if (!silent) {
      setError(null);
    }
    try {
      const data = await withTimeout(
        fetchGamesWithSupabaseSync(slug, ymd),
        CLIENT_SCOREBOARD_TIMEOUT_MS,
        "Scoreboard request",
      );
      const next = data ?? [];
      setGames(next);
      const key = `${slug}:${ymd}`;
      cacheRef.current.set(key, next);
      try {
        localStorage.setItem("score-cache-v1", JSON.stringify(Object.fromEntries(cacheRef.current)));
      } catch {
        // ignore storage quota issues
      }
      if (silent) {
        setError(null);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not load games.";
      if (silent) {
        console.warn("[scoreboard poll]", message, e);
      } else {
        console.error("[scoreboard] Load failed:", message, e);
        setGames([]);
        setError(message);
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      setGames(cached);
      setLoading(false);
      setError(null);
      return;
    }
    void refresh(league, dateKey, { silent: false });
  }, [cacheKey, dateKey, league, refresh]);

  useEffect(() => {
    const hasLive = games.some((g) => g.status_kind === "live");
    if (!hasLive) return;
    const id = setInterval(() => {
      void refresh(league, dateKey, { silent: true });
    }, 60_000);
    return () => clearInterval(id);
  }, [games, league, dateKey, refresh]);

  return (
    <div
      className="min-h-screen bg-zinc-950 text-zinc-100"
      style={{ minHeight: "100vh", backgroundColor: "#09090b", color: "#fafafa" }}
    >
      <header className="border-b border-zinc-800 px-4 pb-2 pt-6">
        <h1 className="text-xl font-semibold tracking-tight text-white">Scoreboard</h1>
        <p className="mt-1 text-sm text-zinc-500" style={{ color: "#a1a1aa" }}>
          Live games from ESPN — saved to Supabase so game threads open reliably.
        </p>
      </header>

      <LeagueSwitcher activeSlug={league} onLeagueChange={setLeague} />
      <div className="border-b border-zinc-800 bg-zinc-950/95 px-4 py-2">
        <div className="flex gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {weekDays.map((d) => {
            const active = d.toDateString() === selectedDate.toDateString();
            const day = new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(d);
            const md = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(d);
            return (
              <button
                key={d.toISOString()}
                type="button"
                onClick={() => setSelectedDate(d)}
                className={`shrink-0 rounded-lg px-3 py-2 text-left transition ${
                  active ? "bg-blue-600/20 text-blue-200 ring-1 ring-blue-500/40" : "bg-zinc-900 text-zinc-400"
                }`}
              >
                <div className="text-xs">{md}</div>
                <div className="text-lg font-semibold leading-tight">{day}</div>
              </button>
            );
          })}
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {supabaseHint ? (
          <div
            className="mb-6 rounded-xl border border-amber-900/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-100/95"
            style={{ border: "1px solid #78350f" }}
          >
            <p className="font-medium text-amber-200">Supabase is not configured correctly</p>
            <p className="mt-2 text-amber-100/85">{supabaseHint}</p>
            <p className="mt-2 text-xs text-amber-200/70">
              Set <code className="rounded bg-black/25 px-1">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
              <code className="rounded bg-black/25 px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in{" "}
              <code className="rounded bg-black/25 px-1">.env.local</code>, then restart{" "}
              <code className="rounded bg-black/25 px-1">npm run dev</code>.
            </p>
          </div>
        ) : null}

        {error ? (
          <div
            className="mb-6 rounded-xl border border-red-900/50 bg-red-950/40 px-4 py-4 text-sm text-red-200"
            style={{ color: "#fecaca", border: "1px solid #7f1d1d" }}
          >
            <p className="font-medium">Could not load games</p>
            <p className="mt-2 whitespace-pre-wrap text-red-200/90">{error}</p>
            <button
              type="button"
              onClick={() => void refresh(league, dateKey, { silent: false })}
              className="mt-4 rounded-full border border-red-400/40 bg-red-900/50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-red-100 hover:bg-red-900/70"
            >
              Try again
            </button>
          </div>
        ) : null}

        {loading ? (
          <div className="space-y-4">
            <p className="text-center text-sm font-medium text-zinc-300">Loading scoreboard…</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <GameCardSkeleton key={i} />
              ))}
            </div>
          </div>
        ) : games.length === 0 ? (
          <div
            className="rounded-xl border border-zinc-700 bg-zinc-900/60 px-6 py-10 text-center"
            style={{ border: "1px solid #3f3f46" }}
          >
            <p className="text-base font-medium text-zinc-100">No games for this league right now</p>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400" style={{ color: "#a1a1aa" }}>
              No games found for this day. Try a different sport tab or select another date in the calendar strip.
            </p>
            <button
              type="button"
              onClick={() => void refresh(league, dateKey, { silent: false })}
              className="mt-6 rounded-full border border-zinc-600 bg-zinc-800 px-5 py-2 text-sm font-medium text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-700"
            >
              Refresh scoreboard
            </button>
          </div>
        ) : (
          <div className="grid animate-fade-in grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {games.map((game) => (
              <GameCard key={game.external_id} game={game} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
