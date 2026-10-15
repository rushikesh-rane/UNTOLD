# UNTOLD editorial layout update

This update applies the editorial navigation and visual language inspired by the supplied reference to supporting pages:
- Creator Studio (`/write`)
- How UNTOLD Works (`/how-it-works`)
- Account (`/account`)

The Discover page and its existing story presentation are intentionally unchanged. Story-card markup, story data, chapter structure, reveal behavior, Supabase routes, authentication, and local demo mode have not been intentionally modified.

## Apply
1. Back up your current project.
2. Extract this ZIP into a new folder.
3. Copy your own `.env.local` into the project root (it is intentionally not included in this ZIP).
4. Run `npm install`, then `npm run dev`.

The shared sidebar links to existing routes. Following, Reading List, and Notifications currently link to the Discover route with view query parameters as navigation placeholders; they are not new fully implemented pages in this visual update.
