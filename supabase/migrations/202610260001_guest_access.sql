-- Guest access: visitors who are not signed in can read only the first part of each story.
--
-- The app already cuts later parts out of /api/stories for guests. This makes the DATABASE enforce the same
-- rule, so nobody can read the rest by calling Supabase directly with the public (anon) key.
--
-- A RESTRICTIVE policy is ANDed with the existing read policy, and it only applies to the "anon" role.
-- Signed-in readers (the "authenticated" role) and authors are not affected at all.
-- Keep the number below in step with GUEST_FREE_PARTS in lib/guest.ts.

drop policy if exists "Guests can read only the free part of a story" on public.chapters;

create policy "Guests can read only the free part of a story" on public.chapters
  as restrictive
  for select
  to anon
  using (position <= 1);
