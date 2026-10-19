# Run this ONCE from the project root (the folder with package.json) AFTER unzipping the update over your project.
# It deletes files and folders that are no longer used. Anything missing is skipped.
$items = @(
  'app\app',                                   # stale duplicate of the app (created live duplicate /app/... pages and API routes)
  'app\supabase',                              # duplicate copy of a migration (the real one is in supabase\migrations)
  'components\ThemeInitializer.tsx',           # unused (the layout has its own theme script)
  'lib\avatar-image.ts',                       # replaced by lib\image-upload.ts
  'untold-before-image-fix.patch',
  'PASTE-AT-BOTTOM-OF-globals.css',            # already applied to globals.css
  'README.txt',
  'AUTH-UPDATE-INSTRUCTIONS.md',               # outdated update notes (useful parts are now in README.md)
  'FEATURE-BATCH-README.md',
  'README-PUBLIC-PROFILES.txt',
  'README-SUPABASE-SETUP.md',
  'REDESIGN-NOTES.md',
  'SECURITY-REVIEW.md',                        # moved to docs\SECURITY-CHECKLIST.md
  'LOCAL-DEMO-MODE.md',                        # moved to docs\LOCAL-DEMO-MODE.md
  'tsconfig.tsbuildinfo'
)
foreach ($item in $items) {
  if (Test-Path $item) { Remove-Item $item -Recurse -Force; Write-Host "deleted  $item" }
  else { Write-Host "skipped  $item (not found)" }
}
Write-Host "`nDone. Now run: npm run lint"
