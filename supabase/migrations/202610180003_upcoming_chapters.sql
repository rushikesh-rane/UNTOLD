-- Lets readers see THAT a later part is scheduled, and WHEN it unlocks, without ever seeing it.
--
-- The "Readers can read released chapters" policy on public.chapters correctly hides every part
-- that has not been released yet, which also means the app could not tell a one-part story from a
-- story with a Part 2 on the way. This function returns only the part number and the release time
-- for scheduled parts of PUBLISHED stories. It never returns the title or the body, so nothing can
-- be spoiled. Drafts are excluded because a draft's reveal_at is only a delay marker.

create or replace function public.upcoming_chapters()
returns table (story_id uuid, "position" integer, reveal_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select c.story_id, c."position", c.reveal_at
  from public.chapters c
  join public.stories s on s.id = c.story_id
  where s.status = 'published'
    and c.is_revealed = true
    and c.reveal_at is not null
    and c.reveal_at > now()
  order by c.story_id, c."position";
$$;

revoke all on function public.upcoming_chapters() from public;
grant execute on function public.upcoming_chapters() to anon, authenticated;

-- Make the API pick up the new function immediately.
notify pgrst, 'reload schema';
