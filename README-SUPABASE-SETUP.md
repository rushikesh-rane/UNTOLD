# UNTOLD Supabase foundation (free to start)

This update adds the Supabase SSR/browser clients, auth session refresh middleware, email/password sign-in and sign-up UI at `/login`, the email confirmation callback, and an initial SQL schema with Row Level Security (RLS).

## 1. Create the free project
1. Create a Supabase project at https://supabase.com/dashboard (choose the Free plan; no paid add-ons are required for this development milestone).
2. In Project Settings → API, copy the Project URL and publishable/anon key.
3. In the UNTOLD project root, copy `.env.example` to `.env.local` and fill `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. In Supabase Authentication → URL Configuration, set Site URL to `http://localhost:3000` for local development and add `http://localhost:3000/auth/callback` to Redirect URLs.

## 2. Apply the database schema
1. Open Supabase → SQL Editor.
2. Paste and run `supabase/migrations/202610110001_initial_schema.sql`.
3. Confirm the tables exist: `profiles`, `stories`, `chapters`, `bookmarks`, `predictions`, `theories`, `theory_votes`, and `follows`.

## 3. Install and run
```bash
npm install
npm run dev
```
Visit `http://localhost:3000/login`, create an account, and check your email if confirmation is enabled. If email delivery/confirmation settings are changed, keep production security in mind.

## Security model
- The browser uses only the publishable/anon key. Never place a Supabase service-role key in a `NEXT_PUBLIC_` variable or browser code.
- RLS is enabled for all application tables.
- Chapter SELECT policy allows the author to read their own chapter, while readers can select chapter rows only if `is_revealed = true`, `reveal_at` is null or has passed, and the parent story is published. This means an unrevealed chapter's body is not returned to an ordinary reader query.
- This is a backend foundation, not yet the full data migration: the existing Discover and Creator Studio still use local storage/seed data. The next implementation pass must replace those read/write paths with authenticated Supabase queries and handle chapter reveal scheduling safely. Do not claim that locally published stories are online until that migration is complete.

## Free-tier notes
Supabase Free is suitable for a prototype and small early testing, but quotas, inactivity pausing, and plan terms can change. Check the current Supabase dashboard and terms before public launch. Vercel Hobby is for personal, non-commercial use; confirm hosting terms if UNTOLD becomes commercial.
