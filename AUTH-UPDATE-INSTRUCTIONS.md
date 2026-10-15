# UNTOLD authentication update

This version requires a Supabase-authenticated session before visitors can access the Discover page, Creator Studio, How It Works, Account, and other app routes. Visitors are redirected to `/login`; after signing in they return to the route they originally requested. `/login` and `/auth/callback` remain public so users can sign in and confirm their email.

## Setup
1. Keep your own `.env.local` in the project root. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to your Supabase project URL and publishable key. Never use a service-role/secret key in browser-exposed variables.
2. In Supabase Authentication URL Configuration, add `http://localhost:3000/auth/callback` to Redirect URLs. Add your production callback URL when deployed.
3. Run `npm install`, then `npm run dev`.
4. Visit `/login`, sign in, and verify that the site returns you to the requested page. Sign out from `/account` to verify that protected pages redirect to login again.

The stories, bookmarks, drafts, and theories are still prototype/local-storage features. Authentication gating does not migrate those records to Supabase or make local-storage data private.
