-- Idempotent: ensures `public.users` exists for Clerk webhooks and server-side upserts.
-- Run in Supabase SQL Editor if `npm run test:webhook` fails with missing `public.users`.
-- If you already applied `004_clerk_users_comments.sql`, this is a no-op for the table (IF NOT EXISTS).

create table if not exists public.users (
  id text primary key,
  username text not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.users enable row level security;

drop policy if exists users_select_public on public.users;
create policy users_select_public on public.users for select using (true);

-- Hint PostgREST to refresh (no-op if not permitted).
select pg_notify('pgrst', 'reload schema');
