UNTOLD profile photo sync patch

Files in this archive are only the changed files. Keep the folder paths intact when copying them into your project root.

What changed:
- Story API now includes each author's avatar_url.
- Discover story detail uses the author's saved profile photo instead of always showing initials.
- Community creator cards show saved profile photos with initials as a fallback.
- Theory and reply avatars use saved profile photos when available.
- CSS makes profile photos fill and crop cleanly inside avatar circles.

The profile editor already saves avatar_url to the profiles table. The public profile and followers/following list pages already read avatar_url, so they were not modified here.

Apply:
1. Back up your existing files.
2. Extract this ZIP into the UNTOLD project root, allowing the listed files to replace their counterparts.
3. Run your usual build/test and verify with an account that has a profile photo.
