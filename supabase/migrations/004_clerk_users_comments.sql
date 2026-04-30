-- Clerk user mirror + comments.user_id as Clerk user id (text)

create table public.users (
  id text primary key,
  username text not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.users enable row level security;

create policy users_select_public on public.users for select using (true);

-- Service role (webhook / server actions) bypasses RLS; no public insert policy needed.

-- Legacy rows use Supabase Auth UUIDs; Clerk user ids are opaque text, so FK to public.users
-- cannot be satisfied without clearing live tables. Archive first so data is recoverable.
create table if not exists public.comments_backup_clerk_migration as
select *, now() as _archived_at from public.comments;

create table if not exists public.highlight_pins_backup_clerk_migration as
select *, now() as _archived_at from public.highlight_pins;

truncate table public.comments cascade;

alter table public.comments drop constraint if exists comments_user_id_fkey;

alter table public.comments
  alter column user_id type text using user_id::text;

alter table public.comments
  add constraint comments_user_id_fkey
  foreign key (user_id) references public.users (id) on delete cascade;
