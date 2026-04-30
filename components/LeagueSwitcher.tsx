"use client";

import { LEAGUES } from "@/lib/api/espn";

type LeagueSwitcherProps = {
  activeSlug: string;
  onLeagueChange: (slug: string) => void;
};

export function LeagueSwitcher({ activeSlug, onLeagueChange }: LeagueSwitcherProps) {
  return (
    <div className="sticky top-0 z-20 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-sm">
      <div
        className="flex gap-2 overflow-x-auto px-4 py-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label="Leagues"
      >
        {LEAGUES.map((league) => {
          const active = league.slug === activeSlug;
          return (
            <button
              key={league.slug}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onLeagueChange(league.slug)}
              className={
                active
                  ? "shrink-0 rounded-full bg-white px-4 py-2 text-sm font-medium text-zinc-900 shadow-sm transition-colors"
                  : "shrink-0 rounded-full px-4 py-2 text-sm font-medium text-zinc-400 transition-colors hover:text-zinc-200"
              }
            >
              {league.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
