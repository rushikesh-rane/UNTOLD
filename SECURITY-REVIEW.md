# UNTOLD security review and deployment checklist

## Included in this source update
- Restored the main application stylesheet from the complete-auth source in this archive and retained current community/creator styles.
- Added baseline response security headers: no MIME sniffing, clickjacking protection, strict referrer policy, limited browser permissions, same-origin opener policy, and disabled framework fingerprint header.
- Enabled Next.js response compression.
- Removed raw Supabase error details from the public stories API response.
- Local published stories now extract Markdown image URLs into the reader gallery.

## Required before production
1. Apply and review all Supabase migrations in order in a staging project first. Confirm RLS is enabled for every user-owned table (`profiles`, `stories`, `chapters`, `bookmarks`, `follows`, `theories`, `predictions`, `theory_votes`). Verify story and chapter `SELECT`, `INSERT`, `UPDATE`, and `DELETE` policies against two separate test accounts.
2. The Supabase publishable/anon key may be present in browser code; **never** expose a `service_role` key. Keep `.env.local` out of source control and shared ZIPs. Rotate any secret that has been exposed.
3. Configure Supabase Auth site URL and exact redirect URLs for local and production domains; enable email confirmation and sensible password/security settings.
4. Verify `story-images` bucket size/MIME restrictions and policies. Public read is expected for public story images; writes/deletes must be limited to the authenticated user's own UUID folder.
5. Test unrevealed chapters using a separate logged-out browser and a second account. Ensure the database RLS policy prevents reading hidden chapter bodies; client-side blur is not access control.
6. Use HTTPS in production. Add a Content Security Policy after testing the app's required Next.js scripts and image/font hosts; an untested restrictive CSP can break the app.
7. Add rate limits to public write endpoints, validate request payloads server-side, and monitor auth/storage/database logs. Use server-side ownership checks for every edit/delete operation.
8. Run `npm ci`, `npm run lint`, and `npm run build` in CI; resolve all failures before deploying. This archive has not been proven production-ready until those checks pass.

## Note
Security is layered. Headers alone do not replace Supabase row-level security, authorization checks, input validation, rate limiting, or deployment configuration.
