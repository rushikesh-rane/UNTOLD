-- OPTIONAL: stop two profiles from having usernames that differ only by letter case
-- (e.g. "Sam" and "sam"). Profile links match usernames ignoring case, so such a pair
-- would make one of the /u/<username> pages fail to load.
--
-- Run this in the Supabase SQL Editor. If it errors with "could not create unique index",
-- two existing profiles already clash: find them with
--   select lower(username), count(*) from public.profiles
--   where username is not null group by 1 having count(*) > 1;
-- rename one of them, then run this again.
create unique index if not exists profiles_username_lower_key
  on public.profiles (lower(username));
