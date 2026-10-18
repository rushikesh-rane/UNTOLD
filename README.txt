UNTOLD Discover Cover Fix

IMPORTANT: The browser URL you tested was http://localhost:3000/ (the root route).
That route uses app/page.tsx, not app/app/page.tsx. The supplied replacement files target the ROOT route.

Replace these files in your project:
  app/page.tsx
  app/globals.css

Back up the existing files first. Do not replace .env.local or any database/API files.

What changed:
- Adds cover_url to the API story type.
- Maps Supabase cover_url to the frontend coverUrl property.
- Displays a cover thumbnail in every Discover story card.
- Shows an UNTOLD placeholder for stories with no saved cover URL.
- Shows a placeholder if a cover image fails to load.
- Adds responsive thumbnail styling.

The existing /api/stories route already selects cover_url, so it is not included.
