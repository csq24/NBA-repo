/** Row from `public.comments` plus joined author display name. */
export type CommentWithAuthor = {
  id: string;
  thread_id: string;
  user_id: string;
  parent_id: string | null;
  body: string;
  upvotes: number;
  tag: string | null;
  created_at: string;
  username: string;
};

/** Row from `public.highlight_pins`. */
export type HighlightPinRow = {
  id: string;
  thread_id: string;
  comment_id: string;
  title: string | null;
  timestamp_label: string | null;
};

/** Row from `public.games` for scoreboard UI. */
export type GameRow = {
  id: string;
  league: string;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  /** Machine phase: `in_progress` | `final` | `scheduled` (cron + filters). */
  status: string;
  /** ESPN-style label (clock, “Final”, etc.) when present. */
  status_detail?: string | null;
  start_time: string;
  external_id: string;
  /** After a final game, cron sets this once full box score is persisted. */
  stats_synced?: boolean | null;
};
