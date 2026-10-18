-- UNTOLD social profiles and threaded replies. Run this migration once in Supabase SQL Editor.
-- It is additive and preserves existing stories, theories, predictions, and follows.

create index if not exists follows_followed_created_idx
  on public.follows (followed_id, created_at desc);

create table if not exists public.replies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  story_id uuid not null references public.stories(id) on delete cascade,
  theory_id uuid references public.theories(id) on delete cascade,
  prediction_id uuid references public.predictions(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now(),
  constraint replies_exactly_one_parent check (
    (theory_id is not null and prediction_id is null) or
    (theory_id is null and prediction_id is not null)
  )
);

create index if not exists replies_theory_created_idx on public.replies (theory_id, created_at asc) where theory_id is not null;
create index if not exists replies_prediction_created_idx on public.replies (prediction_id, created_at asc) where prediction_id is not null;

alter table public.replies enable row level security;
drop policy if exists "Replies on published stories are readable" on public.replies;
drop policy if exists "Signed-in readers can reply to published story discussions" on public.replies;
drop policy if exists "Readers can delete their own replies" on public.replies;
create policy "Replies on published stories are readable" on public.replies
  for select to authenticated using (
    exists (select 1 from public.stories s where s.id = replies.story_id and s.status = 'published')
  );
create policy "Signed-in readers can reply to published story discussions" on public.replies
  for insert to authenticated with check (
    auth.uid() = user_id and
    exists (select 1 from public.stories s where s.id = replies.story_id and s.status = 'published') and
    ((theory_id is not null and exists (select 1 from public.theories t where t.id = replies.theory_id and t.story_id = replies.story_id)) or
     (prediction_id is not null and exists (select 1 from public.predictions p where p.id = replies.prediction_id and p.story_id = replies.story_id)))
  );
create policy "Readers can delete their own replies" on public.replies
  for delete to authenticated using (auth.uid() = user_id);
