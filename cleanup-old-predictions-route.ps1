# Run once from the project root after unzipping:  powershell -ExecutionPolicy Bypass -File .\cleanup-old-predictions-route.ps1
# Removes the old free-text predictions API, which the new prediction polls replace.
if (Test-Path 'app\api\predictions') { Remove-Item 'app\api\predictions' -Recurse -Force; Write-Host 'deleted  app\api\predictions' }
else { Write-Host 'skipped  app\api\predictions (not found)' }
