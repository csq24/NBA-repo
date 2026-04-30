-- Allow anon to upsert games from the public scoreboard (ESPN → public.games).
-- Needed because the home page sync runs without a logged-in user.
-- Tighten later (e.g. Edge Function + service role only) if abuse becomes a concern.

create policy games_insert_anon on public.games for insert to anon with check (true);

create policy games_update_anon on public.games for update to anon using (true) with check (true);
