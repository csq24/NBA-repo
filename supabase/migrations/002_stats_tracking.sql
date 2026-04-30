-- Players, per-game stats, and season aggregates (ESPN-aligned IDs).

create table public.players (
  id uuid primary key default gen_random_uuid(),
  external_id text not null unique,
  name text not null,
  team_id uuid not null references public.teams (id) on delete restrict,
  position text,
  jersey_number text,
  headshot_url text,
  is_active boolean not null default true
);

create table public.game_player_stats (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete restrict,
  minutes text,
  points int,
  rebounds int,
  assists int,
  steals int,
  blocks int,
  turnovers int,
  fouls int,
  plus_minus int,
  fg_made int,
  fg_attempted int,
  three_made int,
  three_attempted int,
  ft_made int,
  ft_attempted int,
  starter boolean not null default false,
  created_at timestamptz not null default now(),
  unique (game_id, player_id)
);

create table public.game_team_stats (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete restrict,
  points int,
  fg_made int,
  fg_attempted int,
  three_made int,
  three_attempted int,
  ft_made int,
  ft_attempted int,
  offensive_rebounds int,
  defensive_rebounds int,
  total_rebounds int,
  assists int,
  steals int,
  blocks int,
  turnovers int,
  fast_break_points int,
  points_in_paint int,
  second_chance_points int,
  bench_points int,
  unique (game_id, team_id)
);

create table public.player_season_averages (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  season text not null,
  league text not null,
  games_played int not null default 0,
  ppg numeric(5, 1),
  rpg numeric(5, 1),
  apg numeric(5, 1),
  spg numeric(5, 1),
  bpg numeric(5, 1),
  topg numeric(5, 1),
  fg_pct numeric(5, 1),
  three_pct numeric(5, 1),
  ft_pct numeric(5, 1),
  minutes_pg numeric(5, 1),
  unique (player_id, season)
);

create table public.team_season_stats (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  season text not null,
  games_played int not null default 0,
  wins int not null default 0,
  losses int not null default 0,
  ppg numeric(5, 1),
  opp_ppg numeric(5, 1),
  fg_pct numeric(5, 1),
  three_pct numeric(5, 1),
  ft_pct numeric(5, 1),
  rpg numeric(5, 1),
  apg numeric(5, 1),
  spg numeric(5, 1),
  bpg numeric(5, 1),
  topg numeric(5, 1),
  unique (team_id, season)
);

create index game_player_stats_game_id_idx on public.game_player_stats (game_id);
create index game_player_stats_player_id_idx on public.game_player_stats (player_id);
create index game_team_stats_game_id_idx on public.game_team_stats (game_id);
create index player_season_averages_player_id_idx on public.player_season_averages (player_id);
create index team_season_stats_team_id_idx on public.team_season_stats (team_id);

alter table public.players enable row level security;
alter table public.game_player_stats enable row level security;
alter table public.game_team_stats enable row level security;
alter table public.player_season_averages enable row level security;
alter table public.team_season_stats enable row level security;

-- Public read (anon + authenticated)
create policy players_select_public on public.players for select using (true);
create policy game_player_stats_select_public on public.game_player_stats for select using (true);
create policy game_team_stats_select_public on public.game_team_stats for select using (true);
create policy player_season_averages_select_public on public.player_season_averages for select using (true);
create policy team_season_stats_select_public on public.team_season_stats for select using (true);

-- Authenticated write (insert + update)
create policy players_insert_authenticated on public.players for insert to authenticated with check (true);
create policy players_update_authenticated on public.players for update to authenticated using (true) with check (true);

create policy game_player_stats_insert_authenticated on public.game_player_stats for insert to authenticated with check (true);
create policy game_player_stats_update_authenticated on public.game_player_stats for update to authenticated using (true) with check (true);

create policy game_team_stats_insert_authenticated on public.game_team_stats for insert to authenticated with check (true);
create policy game_team_stats_update_authenticated on public.game_team_stats for update to authenticated using (true) with check (true);

create policy player_season_averages_insert_authenticated on public.player_season_averages for insert to authenticated with check (true);
create policy player_season_averages_update_authenticated on public.player_season_averages for update to authenticated using (true) with check (true);

create policy team_season_stats_insert_authenticated on public.team_season_stats for insert to authenticated with check (true);
create policy team_season_stats_update_authenticated on public.team_season_stats for update to authenticated using (true) with check (true);
