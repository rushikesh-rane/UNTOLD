-- UNTOLD initial schema. Run in Supabase SQL Editor or with Supabase CLI.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text not null default 'Reader',
  bio text not null default '',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint username_format check (username is null or username ~ '^[a-zA-Z0-9_]{3,24}$')
);

create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 4 and 100),
  genre text not null default 'Mystery',
  synopsis text not null default '' check (char_length(synopsis) <= 220),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  cover_url text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists stories_public_feed_idx on public.stories (published_at desc) where status = 'published';
create index if not exists stories_author_idx on public.stories (author_id, updated_at desc);

create table if not exists public.chapters (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  position integer not null check (position > 0),
  title text not null check (char_length(title) between 1 and 80),
  body text not null default '' check (char_length(body) <= 12000),
  reveal_at timestamptz,
  is_revealed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (story_id, position)
);
create index if not exists chapters_story_order_idx on public.chapters (story_id, position);

create table if not exists public.bookmarks (
  user_id uuid not null references public.profiles(id) on delete cascade,
  story_id uuid not null references public.stories(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, story_id)
);

create table if not exists public.predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  story_id uuid not null references public.stories(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists predictions_story_idx on public.predictions (story_id, created_at desc);

create table if not exists public.theories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  story_id uuid not null references public.stories(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists theories_story_idx on public.theories (story_id, created_at desc);

create table if not exists public.theory_votes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  theory_id uuid not null references public.theories(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, theory_id)
);

create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followed_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followed_id),
  constraint cannot_follow_self check (follower_id <> followed_id)
);

-- Automatically create a profile for each new auth user.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, username)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), 'Reader'),
    nullif(new.raw_user_meta_data ->> 'username', '')
  ) on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

-- RLS is mandatory: never expose the service-role key to the browser.
alter table public.profiles enable row level security;
alter table public.stories enable row level security;
alter table public.chapters enable row level security;
alter table public.bookmarks enable row level security;
alter table public.predictions enable row level security;
alter table public.theories enable row level security;
alter table public.theory_votes enable row level security;
alter table public.follows enable row level security;

create policy "Profiles are readable" on public.profiles for select using (true);
create policy "Users create their own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "Users update their own profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "Published stories are public; authors see their own" on public.stories for select
using (status = 'published' or auth.uid() = author_id);
create policy "Authenticated users create their own stories" on public.stories for insert
with check (auth.uid() = author_id);
create policy "Authors update their own stories" on public.stories for update
using (auth.uid() = author_id) with check (auth.uid() = author_id);
create policy "Authors delete their own stories" on public.stories for delete using (auth.uid() = author_id);

-- Crucial: a reader cannot SELECT the body of an unrevealed chapter.
-- The policy permits the author to read their own chapter; readers only see published,
-- revealed chapters whose reveal_at is null or has passed.
create policy "Authors or readers of revealed chapters can read" on public.chapters for select
using (
  auth.uid() = author_id
  or (
    is_revealed = true
    and (reveal_at is null or reveal_at <= now())
    and exists (select 1 from public.stories s where s.id = story_id and s.status = 'published')
  )
);
create policy "Authors create chapters for their stories" on public.chapters for insert
with check (
  auth.uid() = author_id and exists (
    select 1 from public.stories s where s.id = story_id and s.author_id = auth.uid()
  )
);
create policy "Authors update their own chapters" on public.chapters for update
using (auth.uid() = author_id and exists (select 1 from public.stories s where s.id = story_id and s.author_id = auth.uid()))
with check (auth.uid() = author_id and exists (select 1 from public.stories s where s.id = story_id and s.author_id = auth.uid()));
create policy "Authors delete their own chapters" on public.chapters for delete
using (auth.uid() = author_id and exists (select 1 from public.stories s where s.id = story_id and s.author_id = auth.uid()));

create policy "Users manage their bookmarks" on public.bookmarks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Published story predictions are readable" on public.predictions for select using (exists (select 1 from public.stories s where s.id = story_id and s.status = 'published'));
create policy "Users create their own predictions" on public.predictions for insert with check (auth.uid() = user_id and exists (select 1 from public.stories s where s.id = story_id and s.status = 'published'));
create policy "Users delete their own predictions" on public.predictions for delete using (auth.uid() = user_id);
create policy "Published story theories are readable" on public.theories for select using (exists (select 1 from public.stories s where s.id = story_id and s.status = 'published'));
create policy "Users create their own theories" on public.theories for insert with check (auth.uid() = user_id and exists (select 1 from public.stories s where s.id = story_id and s.status = 'published'));
create policy "Users delete their own theories" on public.theories for delete using (auth.uid() = user_id);
create policy "Theory votes are readable" on public.theory_votes for select using (true);
create policy "Users manage their votes" on public.theory_votes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Follows are readable" on public.follows for select using (true);
create policy "Users manage their follows" on public.follows for all using (auth.uid() = follower_id) with check (auth.uid() = follower_id);

-- Keep published story timestamps consistent when a draft is published.
create or replace function public.set_story_published_at()
returns trigger language plpgsql as $$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    new.published_at = now();
  end if;
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists set_story_published_at_trigger on public.stories;
create trigger set_story_published_at_trigger before insert or update on public.stories
for each row execute function public.set_story_published_at();
