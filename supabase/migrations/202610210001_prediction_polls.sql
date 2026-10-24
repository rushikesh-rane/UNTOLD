-- Predictions become an author-controlled poll ("What happens next?") with options the author chooses.
-- Theories stay as free-text ideas.
--
-- Run this once in the Supabase SQL Editor AFTER 202610200001_security_hardening.sql (it reuses that file's
-- rate-limit function). Safe to run again. It does not delete any existing data: the old free-text predictions
-- stay in their table, they are just no longer shown or accepted.
--
-- How it is locked down: nobody writes to these tables directly. Everything goes through the functions below,
-- which check who you are and what state the poll is in. Row-level security only allows reading.

begin;

-- ---------------------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------------------
create table if not exists public.prediction_polls (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  question text not null check (char_length(question) between 5 and 160),
  status text not null default 'open' check (status in ('open', 'closed')),
  correct_option_id uuid,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.prediction_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.prediction_polls(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 120),
  position smallint not null check (position between 1 and 6),
  created_at timestamptz not null default now(),
  unique (poll_id, position)
);

alter table public.prediction_polls drop constraint if exists prediction_polls_correct_option_fk;
alter table public.prediction_polls add constraint prediction_polls_correct_option_fk
  foreign key (correct_option_id) references public.prediction_options(id) on delete set null;

-- One pick per reader per poll. Changing your mind updates the same row.
create table if not exists public.prediction_votes (
  poll_id uuid not null references public.prediction_polls(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  option_id uuid not null references public.prediction_options(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);

-- A story can have many polls over time (one per part, say) but only one open at a time.
create unique index if not exists prediction_polls_one_open_per_story on public.prediction_polls (story_id) where status = 'open';
create index if not exists prediction_polls_story_created_idx on public.prediction_polls (story_id, created_at desc);
create index if not exists prediction_polls_author_created_idx on public.prediction_polls (author_id, created_at desc);
create index if not exists prediction_votes_user_created_idx on public.prediction_votes (user_id, created_at desc);
create index if not exists prediction_votes_option_idx on public.prediction_votes (option_id);

-- ---------------------------------------------------------------------------------------------------------
-- Row-level security: read-only. There are deliberately no insert/update policies.
-- ---------------------------------------------------------------------------------------------------------
alter table public.prediction_polls enable row level security;
alter table public.prediction_options enable row level security;
alter table public.prediction_votes enable row level security;

drop policy if exists "Predictions are visible with their story" on public.prediction_polls;
create policy "Predictions are visible with their story" on public.prediction_polls
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.stories s
      where s.id = prediction_polls.story_id
        and (s.status = 'published' or s.author_id = (select auth.uid()))
    )
  );

drop policy if exists "Authors can delete their own predictions" on public.prediction_polls;
create policy "Authors can delete their own predictions" on public.prediction_polls
  for delete to authenticated
  using (author_id = (select auth.uid()));

drop policy if exists "Prediction options are visible with their story" on public.prediction_options;
create policy "Prediction options are visible with their story" on public.prediction_options
  for select to anon, authenticated
  using (
    exists (
      select 1
      from public.prediction_polls p
      join public.stories s on s.id = p.story_id
      where p.id = prediction_options.poll_id
        and (s.status = 'published' or s.author_id = (select auth.uid()))
    )
  );

-- Readers can see only their own pick. Totals are available through prediction_option_counts() below.
drop policy if exists "Readers can see their own prediction picks" on public.prediction_votes;
create policy "Readers can see their own prediction picks" on public.prediction_votes
  for select to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------------------------------------
-- Rate limits (uses public.enforce_rate_limit from the security migration)
-- ---------------------------------------------------------------------------------------------------------
drop trigger if exists rate_limit_prediction_polls on public.prediction_polls;
create trigger rate_limit_prediction_polls before insert on public.prediction_polls
  for each row execute function public.enforce_rate_limit('author_id', '1 hour', '20');

drop trigger if exists rate_limit_prediction_votes on public.prediction_votes;
create trigger rate_limit_prediction_votes before insert on public.prediction_votes
  for each row execute function public.enforce_rate_limit('user_id', '1 minute', '30', '1 hour', '300');

-- ---------------------------------------------------------------------------------------------------------
-- Author: create or replace the open prediction for a story.
-- Options can only be edited while nobody has voted yet, so nobody's pick is ever silently changed.
-- Messages that start with "poll: " are written to be shown to the person as they are.
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.save_prediction_poll(p_story_id uuid, p_question text, p_options text[])
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_author uuid;
  v_question text := btrim(coalesce(p_question, ''));
  v_clean text[] := '{}';
  v_item text;
  v_open_id uuid;
  v_id uuid;
  i int;
begin
  if v_uid is null then
    raise exception 'poll: Sign in to set up a prediction.';
  end if;

  select author_id into v_author from public.stories where id = p_story_id;
  if v_author is null or v_author <> v_uid then
    raise exception 'poll: Only the story''s author can set up its prediction.';
  end if;

  if char_length(v_question) < 5 or char_length(v_question) > 160 then
    raise exception 'poll: The question must be between 5 and 160 characters.';
  end if;

  foreach v_item in array coalesce(p_options, '{}'::text[]) loop
    if btrim(coalesce(v_item, '')) <> '' then
      v_clean := v_clean || btrim(v_item);
    end if;
  end loop;

  if cardinality(v_clean) < 2 or cardinality(v_clean) > 6 then
    raise exception 'poll: Add between 2 and 6 options.';
  end if;

  foreach v_item in array v_clean loop
    if char_length(v_item) > 120 then
      raise exception 'poll: Each option can be at most 120 characters.';
    end if;
  end loop;

  if (select count(distinct lower(x)) from unnest(v_clean) as x) <> cardinality(v_clean) then
    raise exception 'poll: Each option must be different.';
  end if;

  select id into v_open_id from public.prediction_polls where story_id = p_story_id and status = 'open';

  if v_open_id is not null then
    if exists (select 1 from public.prediction_votes where poll_id = v_open_id) then
      raise exception 'poll: Readers have already voted, so the options can no longer be changed. Close this prediction and start a new one.';
    end if;
    update public.prediction_polls set question = v_question, updated_at = now() where id = v_open_id;
    delete from public.prediction_options where poll_id = v_open_id;
    v_id := v_open_id;
  else
    insert into public.prediction_polls (story_id, author_id, question)
    values (p_story_id, v_uid, v_question)
    returning id into v_id;
  end if;

  for i in 1 .. cardinality(v_clean) loop
    insert into public.prediction_options (poll_id, label, position) values (v_id, v_clean[i], i);
  end loop;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------
-- Reader: pick (or change) an option.
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.vote_on_prediction(p_poll_id uuid, p_option_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_status text;
  v_story_author uuid;
begin
  if v_uid is null then
    raise exception 'poll: Sign in to make a prediction.';
  end if;

  select p.status, s.author_id into v_status, v_story_author
  from public.prediction_polls p
  join public.stories s on s.id = p.story_id
  where p.id = p_poll_id and s.status = 'published';

  if v_status is null then
    raise exception 'poll: That prediction is not available.';
  end if;
  if v_story_author = v_uid then
    raise exception 'poll: You can''t predict the outcome of your own story.';
  end if;
  if v_status <> 'open' then
    raise exception 'poll: Voting on this prediction has closed.';
  end if;
  if not exists (select 1 from public.prediction_options where id = p_option_id and poll_id = p_poll_id) then
    raise exception 'poll: That option does not belong to this prediction.';
  end if;

  insert into public.prediction_votes (poll_id, user_id, option_id)
  values (p_poll_id, v_uid, p_option_id)
  on conflict (poll_id, user_id) do update set option_id = excluded.option_id, updated_at = now();
end;
$$;

-- ---------------------------------------------------------------------------------------------------------
-- Author: close voting, reopen it, or reveal the real answer.
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.set_prediction_status(p_poll_id uuid, p_action text, p_option_id uuid default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_poll public.prediction_polls%rowtype;
begin
  if v_uid is null then
    raise exception 'poll: Sign in first.';
  end if;

  select * into v_poll from public.prediction_polls where id = p_poll_id;
  if not found or v_poll.author_id <> v_uid then
    raise exception 'poll: Only the story''s author can do that.';
  end if;

  if p_action = 'close' then
    update public.prediction_polls set status = 'closed', updated_at = now() where id = p_poll_id;

  elsif p_action = 'reopen' then
    if v_poll.correct_option_id is not null then
      raise exception 'poll: The answer has been revealed, so voting can''t be reopened. Start a new prediction instead.';
    end if;
    if exists (select 1 from public.prediction_polls where story_id = v_poll.story_id and status = 'open' and id <> p_poll_id) then
      raise exception 'poll: Another prediction is already open for this story.';
    end if;
    update public.prediction_polls set status = 'open', updated_at = now() where id = p_poll_id;

  elsif p_action = 'resolve' then
    if p_option_id is null or not exists (select 1 from public.prediction_options where id = p_option_id and poll_id = p_poll_id) then
      raise exception 'poll: Choose which option turned out to be right.';
    end if;
    update public.prediction_polls
    set status = 'closed', correct_option_id = p_option_id, resolved_at = now(), updated_at = now()
    where id = p_poll_id;

  else
    raise exception 'poll: Unknown action.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------
-- Counts only (never who picked what).
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.prediction_option_counts(p_poll_id uuid)
returns table (option_id uuid, vote_count bigint)
language sql stable security definer set search_path = '' as $$
  select o.id, count(v.user_id)::bigint
  from public.prediction_options o
  join public.prediction_polls p on p.id = o.poll_id
  join public.stories s on s.id = p.story_id
  left join public.prediction_votes v on v.option_id = o.id
  where o.poll_id = p_poll_id
    and (s.status = 'published' or s.author_id = auth.uid())
  group by o.id;
$$;

-- Total picks per story, for the "N predictions" number on story cards.
create or replace function public.prediction_vote_totals(p_story_ids uuid[])
returns table (story_id uuid, total bigint)
language sql stable security definer set search_path = '' as $$
  select p.story_id, count(v.user_id)::bigint
  from public.prediction_polls p
  join public.stories s on s.id = p.story_id and s.status = 'published'
  join public.prediction_votes v on v.poll_id = p.id
  where p.story_id = any(p_story_ids)
  group by p.story_id;
$$;

revoke all on function public.save_prediction_poll(uuid, text, text[]) from public, anon;
grant execute on function public.save_prediction_poll(uuid, text, text[]) to authenticated;

revoke all on function public.vote_on_prediction(uuid, uuid) from public, anon;
grant execute on function public.vote_on_prediction(uuid, uuid) to authenticated;

revoke all on function public.set_prediction_status(uuid, text, uuid) from public, anon;
grant execute on function public.set_prediction_status(uuid, text, uuid) to authenticated;

revoke all on function public.prediction_option_counts(uuid) from public;
grant execute on function public.prediction_option_counts(uuid) to anon, authenticated;

revoke all on function public.prediction_vote_totals(uuid[]) from public;
grant execute on function public.prediction_vote_totals(uuid[]) to anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- The old free-text predictions: keep what is there, stop accepting new ones.
-- ---------------------------------------------------------------------------------------------------------
revoke insert, update on public.predictions from anon, authenticated;

commit;
