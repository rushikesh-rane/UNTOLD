# UNTOLD Local Demo Mode

This is a development-only way to preview the app without a working email confirmation flow. It is not a real Supabase account.

Add these to `.env.local` for local development only:

```env
UNTOLD_LOCAL_DEMO_MODE=true
NEXT_PUBLIC_ENABLE_LOCAL_DEMO=true
```

Restart `npm run dev`, then open `/login` and choose **Enter demo mode**. The demo cookie expires after 8 hours. Visit `/demo-access` is what the button uses.

To disable it, set both variables to `false` (or remove them) and restart the dev server.

**Security and feature limitations:** Never enable `UNTOLD_LOCAL_DEMO_MODE=true` on a deployed/public site. Demo mode bypasses the app's page-level login gate and is only meant for a local development server. It does not create a Supabase session, and database-backed write actions remain unavailable because Supabase Row Level Security still requires a real authenticated user. Use a real account to test cloud saves, publishing, bookmarks, theories, or votes.
