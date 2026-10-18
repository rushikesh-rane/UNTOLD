UNTOLD — Public Profiles Update

Contents (copy these paths into the root of your existing Next.js project):
- app/app/page.tsx
- app/community/page.tsx
- app/globals.css
- app/u/[username]/page.tsx
- app/u/[username]/follow-button.tsx
- app/u/[username]/[list]/page.tsx

What this update adds:
- Click a real creator's avatar/name in the story reader to open their public profile.
- Profiles can be resolved by username OR profile UUID, so existing accounts whose username is NULL (such as Minnie) still work.
- Public profile details, published stories, follower/following counts and lists.
- Follow/unfollow on other users' public profiles.
- Profile links from creator cards and community discussion authors where a user ID is available.
- Public pages only show published stories and contain no controls to edit/delete another user's content.

Install:
1. Make a backup of your current files.
2. Extract this ZIP into your project root and allow it to replace the listed files.
3. Keep your existing .env.local; it is not included in this ZIP.
4. Run `npm run build` and then `npm run dev`.

Notes:
- Profile routes are `/u/<username>` when a username exists, or `/u/<profile-uuid>` when it does not.
- This update relies on your existing `profiles`, `stories`, and `follows` tables and current `/api/follows` endpoint. It does not require a new migration.
- Database Row Level Security remains the actual security boundary for write permissions. This update does not grant visitors permission to edit/delete other users' stories.
