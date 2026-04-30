import Link from "next/link";
import { notFound } from "next/navigation";

import { CommentThread } from "@/components/CommentThread";
import { GameLivePanel } from "@/components/game/GameLivePanel";
import { hasClerkConfigured } from "@/lib/clerk/env";
import { loadGameBoxscore } from "@/lib/game/loadGameBoxscore";
import { loadMatchStatsBundle } from "@/lib/match-stats/loadMatchStats";
import type { MatchStatsBundle } from "@/lib/match-stats/types";
import { syncGameStats, syncPregameRosterZeros } from "@/lib/services/statSync";
import { tryCreateClient } from "@/lib/supabase/server";
import { tryCreateServiceRoleClient } from "@/lib/supabase/serviceRole";
import type { CommentWithAuthor, GameRow, HighlightPinRow } from "@/types/thread";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type FetchGameResult =
  | { status: "ok"; game: GameRow }
  | { status: "not_found" }
  | { status: "db_error"; message: string; code?: string };

async function fetchGameRow(
  supabase: NonNullable<ReturnType<typeof tryCreateClient>>,
  idParam: string,
): Promise<FetchGameResult> {
  if (UUID_RE.test(idParam)) {
    const { data, error } = await supabase.from("games").select("*").eq("id", idParam).maybeSingle();
    if (error) {
      return { status: "db_error", message: error.message, code: error.code };
    }
    if (data) {
      return { status: "ok", game: data as GameRow };
    }
  }
  const { data, error } = await supabase
    .from("games")
    .select("*")
    .eq("external_id", idParam)
    .maybeSingle();
  if (error) {
    return { status: "db_error", message: error.message, code: error.code };
  }
  if (data) {
    return { status: "ok", game: data as GameRow };
  }
  return { status: "not_found" };
}

function SupabaseSetupHint() {
  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-16 text-center text-zinc-300">
      <p className="text-lg font-medium text-white">Supabase is not configured</p>
      <p className="mt-2 max-w-lg text-sm text-zinc-500">
        In <code className="text-zinc-400">.env.local</code>, set real values from Supabase (Project Settings → API):
        <code className="text-zinc-400"> NEXT_PUBLIC_SUPABASE_URL</code> must be your project URL (e.g.{" "}
        <code className="text-zinc-400">https://…supabase.co</code>), and{" "}
        <code className="text-zinc-400">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> must be the long <code className="text-zinc-400">anon</code>{" "}
        public key — not the variable names pasted as values. Then run SQL migrations and restart{" "}
        <code className="text-zinc-400">npm run dev</code>.
      </p>
      <Link href="/" className="mt-8 inline-block text-sm text-amber-200 underline">
        ← Back to scoreboard
      </Link>
    </div>
  );
}

const MIGRATION_ORDER = [
  "001_initial.sql",
  "002_profiles_thread_rpc_realtime.sql",
  "002_stats_tracking.sql",
  "003_games_anon_upsert.sql",
  "003_stat_views.sql",
  "004_clerk_users_comments.sql",
  "005_games_stats_synced.sql",
  "006_games_canonical_status.sql",
  "007_ensure_public_users.sql",
  "008_match_soccer_stats.sql",
] as const;

function GamesSchemaHint({ message, code }: { message: string; code?: string }) {
  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-16 text-center text-zinc-300">
      <h1 className="text-lg font-semibold text-white">Supabase schema is missing or out of date</h1>
      <p className="mx-auto mt-3 max-w-xl text-sm text-zinc-400">
        The app could not read <code className="text-zinc-500">public.games</code>. Until migrations run, the home page
        cannot sync ESPN games into the database, so every game link shows as missing.
      </p>
      <p className="mx-auto mt-4 max-w-xl text-left text-sm text-zinc-400">
        <span className="font-medium text-zinc-300">Fix:</span> In the Supabase dashboard, open{" "}
        <strong className="text-zinc-200">SQL Editor</strong>. For each file below, open it in your repo, copy all SQL,
        paste into a new query, run it, then move to the next (order matters — there are two{" "}
        <code className="text-zinc-500">002_</code> and two <code className="text-zinc-500">003_</code> files).
      </p>
      <ol className="mx-auto mt-4 max-w-xl list-decimal space-y-1.5 pl-6 text-left text-sm text-zinc-300">
        {MIGRATION_ORDER.map((name) => (
          <li key={name}>
            <code className="text-xs text-amber-200/90">{name}</code>
          </li>
        ))}
      </ol>
      <p className="mx-auto mt-4 max-w-xl text-left text-sm text-zinc-500">
        Then reload the scoreboard (home page) so games upsert, and open this game again. If you use the Supabase CLI
        instead: <code className="text-zinc-500">supabase db push</code> or link the project and apply migrations from
        your machine.
      </p>
      {code ? (
        <p className="mt-4 font-mono text-xs text-zinc-500">
          Code: <span className="text-amber-200/90">{code}</span>
        </p>
      ) : null}
      <p className="mt-2 max-w-2xl break-words font-mono text-xs text-red-400/90">{message}</p>
      <Link href="/" className="mt-10 inline-block text-sm text-amber-200 underline">
        ← Back to scoreboard
      </Link>
    </div>
  );
}

type GamePageProps = {
  params: { id: string };
};

export default async function GamePage({ params }: GamePageProps) {
  const supabase = tryCreateClient();
  if (!supabase) {
    return <SupabaseSetupHint />;
  }

  const fetched = await fetchGameRow(supabase, params.id);
  if (fetched.status === "db_error") {
    return <GamesSchemaHint message={fetched.message} code={fetched.code} />;
  }
  if (fetched.status === "not_found") {
    notFound();
  }
  const game = fetched.game;

  const { data: threadId, error: threadErr } = await supabase.rpc("ensure_thread_for_game", {
    p_game_id: game.id,
  });

  if (threadErr || !threadId) {
    return (
      <div className="min-h-screen bg-zinc-950 px-4 py-16 text-center text-red-300">
        <p>Could not open discussion thread for this game.</p>
        <p className="mt-2 font-mono text-xs text-red-400/80">{threadErr?.message}</p>
        <Link href="/" className="mt-8 inline-block text-sm text-zinc-400 underline">
          ← Back
        </Link>
      </div>
    );
  }

  const thread = String(threadId);

  const { data: rawComments } = await supabase
    .from("comments")
    .select("*")
    .eq("thread_id", thread)
    .order("created_at", { ascending: true });

  const commentRows = rawComments ?? [];
  const userIds = Array.from(new Set(commentRows.map((c) => c.user_id as string)));
  let userMap = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: users } = await supabase
      .from("users")
      .select("id, username")
      .in("id", userIds);
    userMap = new Map((users ?? []).map((u) => [u.id as string, u.username as string]));
  }

  const initialComments: CommentWithAuthor[] = commentRows.map((r) => ({
    id: r.id as string,
    thread_id: r.thread_id as string,
    user_id: r.user_id as string,
    parent_id: (r.parent_id as string | null) ?? null,
    body: r.body as string,
    upvotes: Number(r.upvotes ?? 0),
    tag: (r.tag as string | null) ?? null,
    created_at: r.created_at as string,
    username: userMap.get(r.user_id as string) ?? "User",
  }));

  const { data: rawPins } = await supabase
    .from("highlight_pins")
    .select("id, thread_id, comment_id, title, timestamp_label")
    .eq("thread_id", thread);

  const initialPins: HighlightPinRow[] = (rawPins ?? []).map((p) => ({
    id: p.id as string,
    thread_id: p.thread_id as string,
    comment_id: p.comment_id as string,
    title: (p.title as string | null) ?? null,
    timestamp_label: (p.timestamp_label as string | null) ?? null,
  }));

  let initialSnapshot = null;
  try {
    initialSnapshot = await loadGameBoxscore(supabase, game.id);
  } catch (e) {
    console.error("[game page] loadGameBoxscore", e);
  }

  const leagueSlug = game.league.toLowerCase().trim();
  const isBasketballBox = leagueSlug === "nba" || leagueSlug === "college-basketball";
  const noBoxRows =
    !initialSnapshot ||
    (initialSnapshot.homePlayers.length === 0 &&
      initialSnapshot.awayPlayers.length === 0 &&
      !initialSnapshot.home?.stats &&
      !initialSnapshot.away?.stats);

  if (isBasketballBox && noBoxRows) {
    const admin = tryCreateServiceRoleClient();
    if (admin) {
      try {
        const synced = await syncGameStats(admin, game.id, game.external_id);
        if (synced.ok && !synced.skipped) {
          initialSnapshot = await loadGameBoxscore(supabase, game.id);
        } else if (!synced.ok) {
          console.warn("[game page] on-demand box score sync:", synced.error);
        }

        const stillEmpty =
          !initialSnapshot ||
          (initialSnapshot.homePlayers.length === 0 &&
            initialSnapshot.awayPlayers.length === 0 &&
            !initialSnapshot.home?.stats &&
            !initialSnapshot.away?.stats);

        if (stillEmpty) {
          const pre = await syncPregameRosterZeros(admin, game.id, game.external_id, game.league);
          if (pre.ok && !pre.skipped && (pre.playersWritten ?? 0) > 0) {
            initialSnapshot = await loadGameBoxscore(supabase, game.id);
          } else if (!pre.ok) {
            console.warn("[game page] pregame roster zeros:", pre.error);
          }
        }
      } catch (e) {
        console.error("[game page] on-demand box score sync", e);
      }
    } else {
      console.warn("[game page] skip on-demand box score sync (set SUPABASE_SERVICE_ROLE_KEY in .env.local)");
    }
  }

  let initialMatchStats = null;
  try {
    initialMatchStats = await loadMatchStatsBundle(supabase, game.id);
  } catch (e) {
    console.error("[game page] loadMatchStatsBundle", e);
  }

  const matchStatsBundle: MatchStatsBundle =
    initialMatchStats ??
    {
      match: null,
      players: [],
      homeAggregate: null,
      awayAggregate: null,
      homeLabel: game.home_team,
      awayLabel: game.away_team,
    };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="border-b border-zinc-800 px-4 py-4">
        <Link
          href="/"
          className="text-sm font-medium text-zinc-400 underline-offset-4 hover:text-white hover:underline"
        >
          ← Back to scoreboard
        </Link>
      </div>

      <GameLivePanel
        gameId={game.id}
        initialGame={game}
        initialSnapshot={initialSnapshot}
        initialMatchStats={matchStatsBundle}
      />

      <CommentThread
        threadId={thread}
        initialComments={initialComments}
        initialPins={initialPins}
        clerkEnabled={hasClerkConfigured()}
      />

      <p className="mx-auto max-w-3xl px-4 pb-10 text-center text-xs text-zinc-600">
        Games are upserted when you load the home scoreboard. The header score uses Supabase Realtime on{" "}
        <code className="text-zinc-500">games</code> when replication is on; the box score polls and refreshes after each{" "}
        <code className="text-zinc-500">/api/sync-boxscore</code> run. For live comments, enable Realtime on{" "}
        <code className="text-zinc-500">comments</code> and <code className="text-zinc-500">highlight_pins</code>.
      </p>
    </div>
  );
}
