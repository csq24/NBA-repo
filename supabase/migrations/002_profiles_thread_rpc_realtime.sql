-- Profiles (display name for comments), auto thread per game, realtime on comments

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index profiles_username_lower on public.profiles (lower(username));

alter table public.profiles enable row level security;

create policy profiles_select_public on public.profiles for select using (true);

create policy profiles_insert_own on public.profiles for insert to authenticated
  with check (auth.uid() = id);

create policy profiles_update_own on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

-- Backfill / sync profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_name text;
  final_name text;
begin
  base_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'user_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'preferred_username'), ''),
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    split_part(coalesce(new.email, 'user'), '@', 1),
    'user'
  );
  final_name := left(regexp_replace(base_name, '\s+', ' ', 'g'), 32) || '_' || left(replace(new.id::text, '-', ''), 8);

  insert into public.profiles (id, username)
  values (new.id, left(final_name, 40))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Create a game thread if missing (callable by anon so read-only pages still get a thread)
create or replace function public.ensure_thread_for_game(p_game_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  tid uuid;
begin
  select t.id into tid from public.threads t where t.game_id = p_game_id limit 1;
  if tid is not null then
    return tid;
  end if;
  insert into public.threads (game_id) values (p_game_id) returning id into tid;
  return tid;
end;
$$;

grant execute on function public.ensure_thread_for_game(uuid) to anon, authenticated;

-- Realtime: in Supabase Dashboard → Database → Replication, enable `public.comments`
-- for `supabase_realtime` so INSERT events reach browser subscribers.
