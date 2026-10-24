# Security

How untold. is protected, what you still need to switch on yourself, and how to check it.

## How the protection is layered

No single layer is enough, so each one assumes the others might fail.

| Layer | What it does | Where |
| --- | --- | --- |
| **Database rules (RLS)** | Decide who can read and write each row. This is the real security boundary, because your public Supabase key lets anyone talk to the database directly. | `supabase/migrations/` |
| **Database limits** | Cap how much one account can create per minute/hour/day and how long text can be. Cannot be bypassed, even by calling the database directly. | `202610200001_security_hardening.sql` |
| **Sign-in gate** | Every page and API route needs a signed-in user, except `/login`. If the Supabase settings are missing in production the site refuses to serve (503) instead of opening up. | `middleware.ts`, `lib/supabase/middleware.ts` |
| **API guard** | Same-site check against cross-site request forgery, rate limit, body-size cap, ID validation, and safe error messages. | `lib/api.ts`, `lib/rate-limit.ts` |
| **Content-Security-Policy** | Tells the browser to run only scripts the server rendered and to load images only from your own storage, which blocks most injected-code attacks and external tracking images. A fresh nonce is generated per request. | `lib/csp.ts`, `middleware.ts` |
| **Headers** | HSTS, no framing, no MIME sniffing, strict referrer, locked-down browser features. | `next.config.ts` |
| **Safe redirects** | The `?next=` value after login can only ever point back to this site. | `lib/security.ts` |
| **CAPTCHA (optional)** | Cloudflare Turnstile on sign-in/sign-up, verified by Supabase. | `components/Turnstile.tsx` |

## Do these once (they can't be done from code)

### 1. Apply the security and prediction migrations
Supabase Dashboard → SQL Editor → run these two files, in this order (each is safe to run twice and does not change existing data; the site keeps working before and after):
1. `supabase/migrations/202610200001_security_hardening.sql`
2. `supabase/migrations/202610210001_prediction_polls.sql` (needs the first one)

To confirm it worked, run:
```sql
select tgname from pg_trigger where tgname like 'rate_limit_%' and not tgisinternal;   -- should list 8 triggers
select proname from pg_proc where proname = 'theory_vote_counts';                      -- should return 1 row
select proname from pg_proc where proname like '%prediction%' order by 1;              -- should list 5 functions after the second migration
select allowed_mime_types, file_size_limit from storage.buckets where id = 'story-images';
```

### 2. Supabase Authentication settings
Authentication → Providers / Sign In:
- **Confirm email: on**, so nobody can sign up with someone else's address.
- **Minimum password length: 10**, with letters and numbers required. (The sign-up form already checks this, but the server setting is the one that can't be bypassed.)
- **Leaked password protection: on** (available on paid plans).
- **Allow anonymous sign-ins: off**, and switch off any provider you do not use.

Authentication → URL Configuration:
- **Site URL:** your real domain. **Redirect URLs:** only the exact callback addresses you use (`https://your-domain/auth/callback`, `http://localhost:3000/auth/callback`). No wildcards.

Authentication → Rate Limits: keep Supabase's defaults or lower them. These protect sign-in and sign-up, which go straight from the browser to Supabase.

Authentication → Sessions / JWT: keep access-token expiry at 1 hour or less, with refresh-token rotation on.

### 3. CAPTCHA (recommended once real people use the site)
1. Create a free Turnstile widget at <https://dash.cloudflare.com> (Turnstile) for your domain.
2. Put the **site key** in `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (hosting dashboard and `.env.local`) and redeploy.
3. In Supabase → Authentication → Attack Protection, switch on **CAPTCHA**, choose Turnstile and paste the **secret key**.

Do steps 2 and 3 together. If Supabase requires CAPTCHA but the site isn't sending one, nobody can sign in.

### 4. Shared rate limiting (recommended for Vercel and other serverless hosting)
Create a free Redis database at <https://upstash.com> and set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. Without them the API limiter still runs but counts per server instance, so treat it as a speed bump. The database limits (above) work either way.

### 5. Hosting settings
- Serve only over HTTPS (Vercel does this by default).
- **Never set `UNTOLD_LOCAL_DEMO_MODE=true` on a deployed site.** It is also hard-disabled in production builds, but don't rely on that alone.
- Keep `.env.local` out of Git and out of shared zip files. If a key was ever shared, rotate it in Supabase → Project Settings → API.

### 6. Check the `story-images` bucket
Storage → `story-images` should be Public, 5 MB limit, allowed types JPEG/PNG/WebP/GIF only. Never allow SVG or HTML. The migration sets this for you.

## Things to know

- **Published stories are readable without logging in** if someone calls Supabase directly, because the database rules say published stories are public. The sign-in gate only covers the website itself. If you want stories visible to members only, the story, chapter, theory, prediction and reply read policies need `to authenticated`.
- **Rate limits** (per account): theories 10/min and 120/hour, predictions 10/min and 60/hour, replies 15/min and 200/hour, new stories 10/hour and 40/day, follows 30/min, bookmarks and votes 60/min. A story can have at most 40 chapters. Prediction picks 30/min and 300/hour; an author can create 20 predictions an hour. Edit the numbers in the migration's trigger definitions if they don't suit you.
- **Seeding lots of test data** through the SQL editor trips these limits too. Disable a trigger temporarily with `alter table public.theories disable trigger rate_limit_theories;` and re-enable it afterwards.
- **Custom Supabase domain:** profile photos and covers are only accepted from `*.supabase.co` storage (or localhost). If you later move to a custom domain, update the two `*_own_storage` constraints in the migration, and `lib/csp.ts` follows `NEXT_PUBLIC_SUPABASE_URL` automatically.
- **If something is blocked after an update**, set `CSP_REPORT_ONLY=true`, reload, and read the browser console: it names exactly what the policy refused. Fix that source, then remove the setting.

## Checks you can run

```bash
npm run test:security   # redirects, rate limiter, input validation, CSP
npm run test:reader     # chapter-release logic
npm run lint
```

## How predictions are protected
Nobody writes to the prediction tables directly: there are no insert or update policies, only read policies. All changes go through database functions that check who you are and the state of the poll. So readers cannot pick twice, vote on a closed prediction, or vote on their own story; only the story's author can create, close or resolve one; options are frozen once anyone has voted; and individual picks are never readable by other people (only totals).

## Testing the database rules yourself (10 minutes, worth doing before a public launch)
1. Create two normal accounts, A and B.
2. As A, publish a story with a chapter scheduled for the future. As B (and logged out), confirm that chapter's text is not visible anywhere, including the Network tab.
3. As B, try to edit or delete A's story from the browser console with the Supabase client. It must fail.
4. Post a theory 11 times within a minute. The 11th must be refused.
5. Try setting a profile photo URL to an outside website. It must be refused.
6. As A, add a prediction to a published story. As B, pick an option and change it. As A, try to vote on your own prediction (refused), then close it and reveal the answer. As B, confirm you see whether you called it, and that B cannot see how any individual voted.
