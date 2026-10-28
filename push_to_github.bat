@echo off
setlocal enabledelayedexpansion
title Push Smart College Attendance to GitHub

echo =======================================================================
echo     BLE-Based Smart College Attendance Management System
echo                 GitHub Automated Upload Script
echo =======================================================================
echo.

:: Check if git is installed
where git >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Git is not installed or not in your system PATH.
    echo Please install Git from https://git-scm.com/ and try again.
    pause
    exit /b 1
)

:: Prompt for GitHub Repository URL
set /p REPO_URL="Enter your GitHub Repository URL (e.g. https://github.com/Username/Repo.git): "
if "%REPO_URL%"=="" (
    echo [ERROR] Repository URL cannot be empty.
    pause
    exit /b 1
)

echo.
echo [1/5] Initializing Git repository...
if not exist .git (
    git init
) else (
    echo Git repository already initialized.
)

echo.
echo [2/5] Staging files (node_modules, .env, and local caches are ignored)...
git add .

echo.
echo [3/5] Creating initial commit...
git commit -m "feat: BLE Smart College Attendance Management System - Full Hackathon Release"

echo.
echo [4/5] Setting main branch and linking remote origin...
git branch -M main
git remote remove origin >nul 2>&1
git remote add origin %REPO_URL%

echo.
echo [5/5] Pushing codebase to GitHub...
git push -u origin main

if %ERRORLEVEL% equ 0 (
    echo.
    echo =======================================================================
    echo [SUCCESS] Your project has been successfully uploaded to GitHub!
    echo Repository: %REPO_URL%
    echo =======================================================================
) else (
    echo.
    echo =======================================================================
    echo [NOTICE] If the push prompted for credentials, please sign in.
    echo If GitHub rejected because remote already contains files (e.g. README), run:
    echo        git pull origin main --rebase
    echo        git push -u origin main
    echo =======================================================================
)

echo.
pause
