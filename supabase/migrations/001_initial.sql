-- Initial schema: games, teams, threads, comments, highlight_pins

create table public.games (
  id uuid primary key default gen_random_uuid(),
  league text not null,
  home_team text not null,
  away_team text not null,
  home_score int,
  away_score int,
  status text not null,
  start_time timestamptz not null,
  external_id text not null unique
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  abbreviation text not null,
  league text not null,
  subreddit_handle text,
  logo_url text
);

create table public.threads (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  parent_id uuid references public.comments (id) on delete set null,
  body text not null,
  upvotes int not null default 0,
  tag text,
  created_at timestamptz not null default now()
);

create table public.highlight_pins (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads (id) on delete cascade,
  comment_id uuid not null references public.comments (id) on delete cascade,
  title text,
  timestamp_label text
);

alter table public.games enable row level security;
alter table public.teams enable row level security;
alter table public.threads enable row level security;
alter table public.comments enable row level security;
alter table public.highlight_pins enable row level security;

-- Public read (anon + authenticated)
create policy games_select_public on public.games for select using (true);
create policy teams_select_public on public.teams for select using (true);
create policy threads_select_public on public.threads for select using (true);
create policy comments_select_public on public.comments for select using (true);
create policy highlight_pins_select_public on public.highlight_pins for select using (true);

-- Authenticated insert
create policy games_insert_authenticated on public.games for insert to authenticated with check (true);
create policy teams_insert_authenticated on public.teams for insert to authenticated with check (true);
create policy threads_insert_authenticated on public.threads for insert to authenticated with check (true);
create policy comments_insert_authenticated on public.comments for insert to authenticated with check (true);
create policy highlight_pins_insert_authenticated on public.highlight_pins for insert to authenticated with check (true);

-- Authenticated update
create policy games_update_authenticated on public.games for update to authenticated using (true) with check (true);
create policy teams_update_authenticated on public.teams for update to authenticated using (true) with check (true);
create policy threads_update_authenticated on public.threads for update to authenticated using (true) with check (true);
create policy comments_update_authenticated on public.comments for update to authenticated using (true) with check (true);
create policy highlight_pins_update_authenticated on public.highlight_pins for update to authenticated using (true) with check (true);
