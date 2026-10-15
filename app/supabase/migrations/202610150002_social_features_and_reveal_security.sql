-- UNTOLD social features + strict chapter reveal access.
-- Safe to apply after the existing initial schema migration.

create index if not exists follows_follower_created_idx on public.follows (follower_id, created_at desc);
create index if not exists follows_followed_idx on public.follows (followed_id);
create index if not exists bookmarks_user_created_idx on public.bookmarks (user_id, created_at desc);
create index if not exists theories_story_created_idx on public.theories (story_id, created_at desc);
create index if not exists predictions_story_created_idx on public.predictions (story_id, created_at desc);
create index if not exists theory_votes_theory_idx on public.theory_votes (theory_id);

-- Ensure the chapter read policy cannot leak unreleased bodies to readers.
-- Authors can read their own chapters; everyone else only gets revealed chapters
-- of published stories once the server-side release timestamp has passed.
alter table public.chapters enable row level security;
drop policy if exists "Authors or readers of revealed chapters can read" on public.chapters;
drop policy if exists "Readers can read released chapters of published stories" on public.chapters;
create policy "Readers can read released chapters of published stories" on public.chapters
for select using (
  auth.uid() = author_id
  or (
    is_revealed = true
    and (reveal_at is null or reveal_at <= now())
    and exists (
      select 1 from public.stories s
      where s.id = chapters.story_id and s.status = 'published'
    )
  )
);

-- Keep user-owned social data private to its owner for writes and reads.
alter table public.bookmarks enable row level security;
drop policy if exists "Users manage their bookmarks" on public.bookmarks;
create policy "Users manage their bookmarks" on public.bookmarks
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.follows enable row level security;
drop policy if exists "Follows are readable" on public.follows;
drop policy if exists "Users manage their follows" on public.follows;
create policy "Follow relationships are visible to signed-in users" on public.follows
for select to authenticated using (true);
create policy "Users manage their own follow relationships" on public.follows
for all using (auth.uid() = follower_id) with check (auth.uid() = follower_id and follower_id <> followed_id);

alter table public.theories enable row level security;
drop policy if exists "Published story theories are readable" on public.theories;
drop policy if exists "Users create their own theories" on public.theories;
drop policy if exists "Users delete their own theories" on public.theories;
create policy "Theories on published stories are readable" on public.theories
for select using (exists (select 1 from public.stories s where s.id = theories.story_id and s.status = 'published'));
create policy "Signed-in readers can post theories on published stories" on public.theories
for insert to authenticated with check (auth.uid() = user_id and exists (select 1 from public.stories s where s.id = theories.story_id and s.status = 'published'));
create policy "Authors can delete their own theories" on public.theories
for delete using (auth.uid() = user_id);

alter table public.predictions enable row level security;
drop policy if exists "Published story predictions are readable" on public.predictions;
drop policy if exists "Users create their own predictions" on public.predictions;
drop policy if exists "Users delete their own predictions" on public.predictions;
create policy "Predictions on published stories are readable" on public.predictions
for select using (exists (select 1 from public.stories s where s.id = predictions.story_id and s.status = 'published'));
create policy "Signed-in readers can post predictions on published stories" on public.predictions
for insert to authenticated with check (auth.uid() = user_id and exists (select 1 from public.stories s where s.id = predictions.story_id and s.status = 'published'));
create policy "Readers can delete their own predictions" on public.predictions
for delete using (auth.uid() = user_id);

alter table public.theory_votes enable row level security;
drop policy if exists "Theory votes are readable" on public.theory_votes;
drop policy if exists "Users manage their votes" on public.theory_votes;
create policy "Theory vote counts are readable" on public.theory_votes
for select using (true);
create policy "Users manage their own theory votes" on public.theory_votes
for all using (auth.uid() = user_id) with check (
  auth.uid() = user_id and exists (
    select 1 from public.theories t
    join public.stories s on s.id = t.story_id
    where t.id = theory_votes.theory_id and s.status = 'published'
  )
);
