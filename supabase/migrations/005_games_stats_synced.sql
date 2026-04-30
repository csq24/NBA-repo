-- Track whether final-game boxscore stats have been persisted (cron skips after success).

alter table public.games
  add column if not exists stats_synced boolean not null default false;
