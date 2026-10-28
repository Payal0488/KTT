Write-Host "=======================================================================" -ForegroundColor Cyan
Write-Host "    BLE-Based Smart College Attendance Management System" -ForegroundColor Green
Write-Host "                GitHub Automated Upload Script" -ForegroundColor Yellow
Write-Host "=======================================================================" -ForegroundColor Cyan
Write-Host ""

$repoUrl = Read-Host "Enter your GitHub Repository URL (e.g. https://github.com/Username/Repo.git)"

if ([string]::IsNullOrWhiteSpace($repoUrl)) {
    Write-Host "[ERROR] Repository URL cannot be empty." -ForegroundColor Red
    exit 1
}

Write-Host "`n[1/5] Initializing Git repository..." -ForegroundColor Yellow
if (-not (Test-Path ".git")) {
    git init
}

Write-Host "`n[2/5] Staging files (node_modules and local cache ignored)..." -ForegroundColor Yellow
git add .

Write-Host "`n[3/5] Creating commit..." -ForegroundColor Yellow
git commit -m "feat: BLE Smart College Attendance Management System - Full Hackathon Release"

Write-Host "`n[4/5] Setting main branch and linking remote origin..." -ForegroundColor Yellow
git branch -M main
git remote remove origin 2>$null
git remote add origin $repoUrl

Write-Host "`n[5/5] Pushing to GitHub..." -ForegroundColor Yellow
git push -u origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n[SUCCESS] Successfully pushed to GitHub: $repoUrl" -ForegroundColor Green
} else {
    Write-Host "`n[NOTICE] If GitHub requires credentials, sign in via the browser/credential manager." -ForegroundColor Yellow
}
