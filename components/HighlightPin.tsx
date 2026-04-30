"use client";

import { Play } from "lucide-react";

type HighlightPinProps = {
  title: string;
  timestampLabel: string;
  commentId: string;
};

export function HighlightPin({ title, timestampLabel, commentId }: HighlightPinProps) {
  return (
    <button
      type="button"
      onClick={() => {
        document.getElementById(`comment-${commentId}`)?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }}
      className="flex shrink-0 items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-left transition hover:border-amber-400/60 hover:bg-amber-500/20"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-200">
        <Play className="h-4 w-4 fill-current" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-medium text-amber-100">{title}</span>
        <span className="block text-[11px] text-amber-200/80">{timestampLabel}</span>
      </span>
    </button>
  );
}
