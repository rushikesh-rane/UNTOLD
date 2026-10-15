# UNTOLD database integration batch

This update connects the Creator Studio to Supabase and adds server routes for published stories, bookmarks, and theories.

## Included
- Creator Studio saves draft stories and chapter rows to Supabase under the authenticated user.
- Publishing updates the story status to `published` and writes chapters to Supabase.
- Discover requests published stories from `/api/stories`; sample stories remain as demo content.
- Cloud story bookmarks use the `bookmarks` table for UUID-backed database stories.
- Reader theories can be submitted to and loaded from the `theories` table for UUID-backed database stories.
- API routes use the server Supabase client and authenticated session; no service-role key is needed.
- Unrevealed chapters are filtered by database RLS. The public API returns only rows the current user's RLS policy permits.

## Setup
1. Keep your existing `.env.local` in the project root. Required variables are `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the latter may contain your Supabase publishable key).
2. The initial schema migration must already have been run in Supabase.
3. Run `npm install` and `npm run dev`.
4. Sign in, open `/write`, save a draft, then publish a test story.
5. Open Discover in another browser/session or refresh to confirm the published story appears.

## Important current limitations
- Existing sample/demo stories are not migrated into Supabase and their interactions remain prototype data.
- The existing vote UI is still local/demo-only; the schema's `theory_votes` table is not wired to a vote endpoint in this batch.
- Scheduled reveals are not automated; `is_revealed` and `reveal_at` are access-control fields, but this batch only stores the creator's Available now / Reveal later selection.
- The app should not be considered production-ready until you test authorization using at least two separate accounts and review all RLS policies.


## Local-only demo mode
See `LOCAL-DEMO-MODE.md` for an optional local preview bypass. It is not a real account and must never be enabled on a public deployment.
