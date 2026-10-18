-- Let signed-out readers see replies, matching theories (which are publicly readable on published stories).
-- Writing a reply still requires a signed-in user (see the insert policy in 202610170001).
drop policy if exists "Replies on published stories are readable" on public.replies;
create policy "Replies on published stories are readable" on public.replies
  for select using (
    exists (select 1 from public.stories s where s.id = replies.story_id and s.status = 'published')
  );
