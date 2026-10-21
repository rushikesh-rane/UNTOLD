# untold.

**Every story has a missing piece.** untold. is a storytelling site where writers publish stories in parts, readers form theories and predictions while they wait, and each part unlocks on a schedule the writer sets.

Built with Next.js (App Router), React, TypeScript, Supabase (auth, Postgres, storage) and plain CSS.

## Features

- **Discover feed** with For you / Trending / New tabs, search, mood filters, bookmarks, and story cards that can preview a story's chapters (locked parts show only a release date).
- **Story reader** with scheduled part releases, image gallery, browser narration (Web Speech API), author profiles, follow, theories with replies and votes, and predictions.
- **Creator Studio** (`/write`) with a rich-text editor, cover and inline image uploads, genre selection, drafts, and per-part "available now / reveal later" scheduling.
- **Community** (`/community`), **public profiles** (`/u/<username>`) with followers and following lists, and an **Account** page with profile photo and bio.
- **Light and dark themes**, a top loading bar, and responsive layouts from phones to wide monitors.

## Run it locally

Requires Node.js 20.9 or newer.

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase values
npm run dev                  # http://localhost:3000
```

Other commands:

| Command | What it does |
| --- | --- |
| `npm run lint` | ESLint |
| `npm run build` / `npm start` | Production build and server |
| `npm test` | Runs all checks below |
| `npm run test:reader` | Unit checks for the part-release logic in `lib/reader.ts` |
| `npm run test:security` | Checks for safe redirects, rate limiting, input validation and the Content-Security-Policy |

## Supabase setup

1. **Create a project** at <https://supabase.com/dashboard>. In Project Settings → API, copy the Project URL and the publishable (anon) key into `.env.local` as `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Never put a `service_role` key in a `NEXT_PUBLIC_` variable.
2. **Run the migrations in order** in the SQL Editor, everything in `supabase/migrations/`, oldest first (`202610110001_…` through `202610200001_security_hardening.sql`).
3. **Auth URLs:** under Authentication → URL Configuration, set the Site URL and add `http://localhost:3000/auth/callback` (and your production callback URL) to Redirect URLs.
4. **Check the `story-images` storage bucket** (Storage → `story-images`). The migration creates it as public with a 5 MB limit and these allowed types: JPEG, PNG, WebP and GIF. If you created the bucket by hand, make sure its allowed types match, because uploads fail with "mime type … is not supported" otherwise. The app converts uploaded photos to JPEG in the browser, so JPEG must always be allowed.

Every page except `/login`, `/auth/callback` and `/demo-access` requires a signed-in user; visitors are redirected to `/login` and sent back afterwards.

## Security

Rate limits, a Content-Security-Policy, CSRF checks, safe redirects, database-enforced limits and optional CAPTCHA are built in. A few things can only be switched on in your Supabase and hosting dashboards. Follow [`docs/SECURITY-CHECKLIST.md`](docs/SECURITY-CHECKLIST.md) before sharing the site publicly.

## Project layout

```
app/                 Pages and API routes (App Router)
  api/               stories, bookmarks, follows, theories, theory votes, replies, predictions (all use lib/api.ts)
  write/             Creator Studio
  account/  u/       Account page and public profiles
  globals.css        Styles (light theme and shared layout)
  dark-theme.css     Dark theme overrides (generated, see below)
components/          Shared UI (editor, sidebar, skeletons, theme toggle, loading bar)
lib/
  api.ts             Shared API guard: CSRF check, rate limit, body parsing, safe errors
  rate-limit.ts      Rate limiter (in-memory, or shared via Upstash Redis)
  security.ts        Safe redirects, ID validation, text cleaning
  csp.ts             Content-Security-Policy builder
  image-upload.ts    Reads, converts and resizes photos before upload (phone gallery safe)
  reader.ts          Part-release and countdown logic
  supabase/          Browser, server and middleware clients
supabase/migrations/ Database schema and security policies
scripts/             Dark-theme generator and reader tests
docs/                Security checklist and local demo mode
```

**Dark theme:** `app/dark-theme.css` is generated from `globals.css` by `python3 scripts/generate-dark-theme.py`, with hand-written tweaks in `app/dark-theme.manual.css`. Re-run the script after large changes to `globals.css`.

## More docs

- [`docs/SECURITY-CHECKLIST.md`](docs/SECURITY-CHECKLIST.md): how the site is protected and what to switch on before going public.
- [`docs/LOCAL-DEMO-MODE.md`](docs/LOCAL-DEMO-MODE.md): a development-only way to preview without signing in. Never enable it on a public site.
