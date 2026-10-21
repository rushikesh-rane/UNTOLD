-- UNTOLD security hardening.
--
-- Run this once in the Supabase SQL Editor (it is safe to run again). It does not delete or change any
-- existing story, user or comment. Everything is inside one transaction, so if anything fails nothing is applied.
--
-- Why this lives in the database: your Supabase "anon" key is public by design, so anyone can call the database
-- directly and skip the website and its /api routes completely. The Creator Studio also writes to the database
-- straight from the browser. Limits and rules therefore have to be enforced here, where they cannot be bypassed.

begin;

-- ---------------------------------------------------------------------------------------------------------
-- 1. Size and format limits for text that had none.
--    "not valid" means: enforced for every new or changed row, but existing rows are not re-checked, so this can
--    never fail because of old data.
-- ---------------------------------------------------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_display_name_length;
alter table public.profiles add constraint profiles_display_name_length
  check (char_length(display_name) between 1 and 60) not valid;

alter table public.profiles drop constraint if exists profiles_bio_length;
alter table public.profiles add constraint profiles_bio_length
  check (char_length(bio) <= 500) not valid;

alter table public.stories drop constraint if exists stories_genre_length;
alter table public.stories add constraint stories_genre_length
  check (char_length(genre) between 1 and 40) not valid;

-- Profile photos and covers may only point at this project's own image storage. Without this, anyone could set
-- their photo to an address on their own server and log the IP address of everyone who views their profile.
-- (Local development storage on 127.0.0.1 / localhost is allowed too.)
alter table public.profiles drop constraint if exists profiles_avatar_url_own_storage;
alter table public.profiles add constraint profiles_avatar_url_own_storage
  check (
    avatar_url is null or (
      char_length(avatar_url) <= 500 and
      avatar_url ~ '^(https://[a-z0-9-]+\.supabase\.co|http://(127\.0\.0\.1|localhost)(:[0-9]+)?)/storage/v1/object/public/story-images/'
    )
  ) not valid;

alter table public.stories drop constraint if exists stories_cover_url_own_storage;
alter table public.stories add constraint stories_cover_url_own_storage
  check (
    cover_url is null or (
      char_length(cover_url) <= 500 and
      cover_url ~ '^(https://[a-z0-9-]+\.supabase\.co|http://(127\.0\.0\.1|localhost)(:[0-9]+)?)/storage/v1/object/public/story-images/'
    )
  ) not valid;

-- Names that could be used to pretend to be the site or its staff.
alter table public.profiles drop constraint if exists profiles_username_not_reserved;
alter table public.profiles add constraint profiles_username_not_reserved
  check (
    username is null or lower(username) not in (
      'admin', 'administrator', 'root', 'support', 'help', 'security', 'staff', 'moderator', 'mod',
      'official', 'system', 'untold', 'untoldapp', 'team', 'api', 'www', 'null', 'undefined'
    )
  ) not valid;

-- ---------------------------------------------------------------------------------------------------------
-- 2. New accounts: ignore a "username" smuggled in through sign-up metadata (the app never sends one) and cap
--    the display name, so sign-up can't be used to claim a reserved name or insert oversized text.
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), 'Reader'), 60)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------
-- 3. "published_at" decides feed order, so authors must not be able to set it by hand (for example to pin a
--    story to the top). It is now set only by the database, at the moment a story is first published.
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.set_story_published_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.published_at := case when new.status = 'published' then now() else null end;
  elsif new.status = 'published' and old.status is distinct from 'published' then
    new.published_at := now();
  else
    new.published_at := old.published_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------
-- 4. Rate limits that cannot be bypassed.
--    Counts how many rows a person created recently and refuses the next one when they are over the limit.
--    Arguments: owner column, then pairs of (time window, maximum rows in that window).
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.enforce_rate_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  owner_column text := tg_argv[0];
  owner_id uuid := (to_jsonb(new) ->> owner_column)::uuid;
  i int := 1;
  recent bigint;
begin
  while i + 1 < tg_nargs loop
    execute format(
      'select count(*) from %I.%I where %I = $1 and created_at > now() - $2::interval',
      tg_table_schema, tg_table_name, owner_column
    ) into recent using owner_id, tg_argv[i];

    if recent >= tg_argv[i + 1]::bigint then
      raise exception 'rate_limit_exceeded: You are doing that too quickly. Please wait a moment and try again.'
        using errcode = 'P0001';
    end if;
    i := i + 2;
  end loop;
  return new;
end;
$$;

-- Indexes so those counts stay fast.
create index if not exists theories_user_created_idx on public.theories (user_id, created_at desc);
create index if not exists predictions_user_created_idx on public.predictions (user_id, created_at desc);
create index if not exists replies_user_created_idx on public.replies (user_id, created_at desc);
create index if not exists stories_author_created_idx on public.stories (author_id, created_at desc);
create index if not exists chapters_author_created_idx on public.chapters (author_id, created_at desc);
create index if not exists theory_votes_user_created_idx on public.theory_votes (user_id, created_at desc);
-- (bookmarks and follows already have a (user, created_at) index.)

drop trigger if exists rate_limit_theories on public.theories;
create trigger rate_limit_theories before insert on public.theories
  for each row execute function public.enforce_rate_limit('user_id', '1 minute', '10', '1 hour', '120');

drop trigger if exists rate_limit_predictions on public.predictions;
create trigger rate_limit_predictions before insert on public.predictions
  for each row execute function public.enforce_rate_limit('user_id', '1 minute', '10', '1 hour', '60');

drop trigger if exists rate_limit_replies on public.replies;
create trigger rate_limit_replies before insert on public.replies
  for each row execute function public.enforce_rate_limit('user_id', '1 minute', '15', '1 hour', '200');

drop trigger if exists rate_limit_stories on public.stories;
create trigger rate_limit_stories before insert on public.stories
  for each row execute function public.enforce_rate_limit('author_id', '1 hour', '10', '1 day', '40');

-- The studio re-saves a story's chapters as a batch, so this limit is generous; it only stops floods.
drop trigger if exists rate_limit_chapters on public.chapters;
create trigger rate_limit_chapters before insert on public.chapters
  for each row execute function public.enforce_rate_limit('author_id', '1 hour', '600');

drop trigger if exists rate_limit_follows on public.follows;
create trigger rate_limit_follows before insert on public.follows
  for each row execute function public.enforce_rate_limit('follower_id', '1 minute', '30', '1 hour', '300');

drop trigger if exists rate_limit_bookmarks on public.bookmarks;
create trigger rate_limit_bookmarks before insert on public.bookmarks
  for each row execute function public.enforce_rate_limit('user_id', '1 minute', '60', '1 hour', '600');

drop trigger if exists rate_limit_theory_votes on public.theory_votes;
create trigger rate_limit_theory_votes before insert on public.theory_votes
  for each row execute function public.enforce_rate_limit('user_id', '1 minute', '60', '1 hour', '600');

-- A single story can't grow without limit either.
create or replace function public.limit_chapters_per_story()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.chapters where story_id = new.story_id) >= 40 then
    raise exception 'A story can have at most 40 chapters.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists limit_chapters_per_story_trigger on public.chapters;
create trigger limit_chapters_per_story_trigger before insert on public.chapters
  for each row execute function public.limit_chapters_per_story();

-- These are trigger functions, not something anyone should be able to call directly.
revoke all on function public.enforce_rate_limit() from public, anon, authenticated;
revoke all on function public.limit_chapters_per_story() from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- 5. Privacy: stop publishing the full list of "who voted for which theory".
--    People can still read their own votes, and everyone can still see the totals through this function,
--    which returns counts only.
-- ---------------------------------------------------------------------------------------------------------
drop policy if exists "Theory vote counts are readable" on public.theory_votes;
drop policy if exists "Theory votes are readable" on public.theory_votes;

create or replace function public.theory_vote_counts(p_story_id uuid default null)
returns table (theory_id uuid, vote_count bigint)
language sql stable security definer set search_path = '' as $$
  select v.theory_id, count(*)::bigint as vote_count
  from public.theory_votes v
  join public.theories t on t.id = v.theory_id
  join public.stories s on s.id = t.story_id
  where s.status = 'published'
    and (p_story_id is null or t.story_id = p_story_id)
  group by v.theory_id
  limit 5000;
$$;

revoke all on function public.theory_vote_counts(uuid) from public;
grant execute on function public.theory_vote_counts(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- 6. Image storage.
--    - Images are still public to view by their link (that works without any policy on a public bucket), but
--      the bucket can no longer be listed to harvest every file name and user id. People can list their own.
--    - Enforce the size and file-type limits on the bucket itself. Only real image types are allowed, never
--      SVG or HTML, which can carry scripts.
-- ---------------------------------------------------------------------------------------------------------
drop policy if exists "Story images are publicly readable" on storage.objects;
drop policy if exists "Users can list their own story images" on storage.objects;
create policy "Users can list their own story images" on storage.objects
  for select to authenticated
  using (bucket_id = 'story-images' and (storage.foldername(name))[1] = auth.uid()::text);

update storage.buckets
set public = true,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
where id = 'story-images';

commit;
