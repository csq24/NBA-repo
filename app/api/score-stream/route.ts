import { fetchGames, LEAGUES, type Game } from "@/lib/api/espn";

export const dynamic = "force-dynamic";

function isAllowedLeague(slug: string): boolean {
  return LEAGUES.some((l) => l.slug === slug);
}

/** Compare without `id` — ESPN normalization uses a new UUID on every fetch. */
function scoreFingerprint(games: Game[] | null): string {
  if (games == null) return "null";
  return JSON.stringify(
    [...games]
      .map((g) => ({
        e: g.external_id,
        hs: g.home_score,
        as: g.away_score,
        st: g.status,
        sk: g.status_kind,
        ht: g.home_team,
        at: g.away_team,
        tm: g.start_time,
      }))
      .sort((a, b) => a.e.localeCompare(b.e)),
  );
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const league = url.searchParams.get("league")?.toLowerCase().trim() ?? "nba";

  if (!isAllowedLeague(league)) {
    return new Response(
      JSON.stringify({
        error: `Unknown league. Use one of: ${LEAGUES.map((l) => l.slug).join(", ")}`,
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const encoder = new TextEncoder();
  let lastFingerprint = "";

  const bag = { intervalId: null as ReturnType<typeof setInterval> | null };

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      const cleanup = () => {
        if (bag.intervalId != null) {
          clearInterval(bag.intervalId);
          bag.intervalId = null;
        }
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      req.signal.addEventListener("abort", cleanup);

      const tick = async () => {
        try {
          const games = await fetchGames(league);
          const fp = scoreFingerprint(games);
          if (fp === lastFingerprint) return;
          lastFingerprint = fp;
          send({ league, games: games ?? [] });
        } catch (e) {
          send({
            type: "error",
            league,
            message: e instanceof Error ? e.message : "Failed to fetch scoreboard",
          });
        }
      };

      await tick();
      bag.intervalId = setInterval(() => {
        void tick();
      }, 10_000);
    },
    cancel() {
      if (bag.intervalId != null) {
        clearInterval(bag.intervalId);
        bag.intervalId = null;
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
