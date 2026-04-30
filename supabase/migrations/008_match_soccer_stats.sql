-- Soccer-style per-match player stats + match rows linked to scoreboard `games`.
-- Reuses existing `teams` and `players`. Optional `game_id` links one match row to `/game/[id]`.

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  game_id uuid unique references public.games (id) on delete cascade,
  home_team_id uuid references public.teams (id) on delete restrict,
  away_team_id uuid references public.teams (id) on delete restrict,
  home_score int not null default 0,
  away_score int not null default 0,
  match_date timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists matches_game_id_idx on public.matches (game_id);
create index if not exists matches_home_team_id_idx on public.matches (home_team_id);
create index if not exists matches_away_team_id_idx on public.matches (away_team_id);

create table if not exists public.match_player_stats (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  goals int not null default 0,
  assists int not null default 0,
  yellow_cards int not null default 0,
  red_cards int not null default 0,
  minutes_played int not null default 0,
  position text,
  created_at timestamptz not null default now(),
  unique (match_id, player_id)
);

create index if not exists match_player_stats_match_id_idx on public.match_player_stats (match_id);
create index if not exists match_player_stats_player_id_idx on public.match_player_stats (player_id);

alter table public.matches enable row level security;
alter table public.match_player_stats enable row level security;

create policy matches_select_public on public.matches for select using (true);
create policy match_player_stats_select_public on public.match_player_stats for select using (true);

create policy matches_insert_authenticated on public.matches for insert to authenticated with check (true);
create policy matches_update_authenticated on public.matches for update to authenticated using (true) with check (true);

create policy match_player_stats_insert_authenticated on public.match_player_stats for insert to authenticated with check (true);
create policy match_player_stats_update_authenticated on public.match_player_stats for update to authenticated using (true) with check (true);
