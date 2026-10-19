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
| `npm run test:reader` | Unit checks for the part-release logic in `lib/reader.ts` |

## Supabase setup

1. **Create a project** at <https://supabase.com/dashboard>. In Project Settings → API, copy the Project URL and the publishable (anon) key into `.env.local` as `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Never put a `service_role` key in a `NEXT_PUBLIC_` variable.
2. **Run the migrations in order** in the SQL Editor, everything in `supabase/migrations/`, oldest first (`202610110001_…` through `202610180003_…`).
3. **Auth URLs:** under Authentication → URL Configuration, set the Site URL and add `http://localhost:3000/auth/callback` (and your production callback URL) to Redirect URLs.
4. **Check the `story-images` storage bucket** (Storage → `story-images`). The migration creates it as public with a 5 MB limit and these allowed types: JPEG, PNG, WebP and GIF. If you created the bucket by hand, make sure its allowed types match, because uploads fail with "mime type … is not supported" otherwise. The app converts uploaded photos to JPEG in the browser, so JPEG must always be allowed.

Every page except `/login`, `/auth/callback` and `/demo-access` requires a signed-in user; visitors are redirected to `/login` and sent back afterwards.

## Project layout

```
app/                 Pages and API routes (App Router)
  api/               stories, bookmarks, follows, theories, theory votes, replies, predictions
  write/             Creator Studio
  account/  u/       Account page and public profiles
  globals.css        Styles (light theme and shared layout)
  dark-theme.css     Dark theme overrides (generated, see below)
components/          Shared UI (editor, sidebar, skeletons, theme toggle, loading bar)
lib/
  image-upload.ts    Reads, converts and resizes photos before upload (phone gallery safe)
  reader.ts          Part-release and countdown logic
  supabase/          Browser, server and middleware clients
supabase/migrations/ Database schema and security policies
scripts/             Dark-theme generator and reader tests
docs/                Security checklist and local demo mode
```

**Dark theme:** `app/dark-theme.css` is generated from `globals.css` by `python3 scripts/generate-dark-theme.py`, with hand-written tweaks in `app/dark-theme.manual.css`. Re-run the script after large changes to `globals.css`.

## More docs

- [`docs/SECURITY-CHECKLIST.md`](docs/SECURITY-CHECKLIST.md): what to verify before going public.
- [`docs/LOCAL-DEMO-MODE.md`](docs/LOCAL-DEMO-MODE.md): a development-only way to preview without signing in. Never enable it on a public site.
