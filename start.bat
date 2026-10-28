@echo off
echo =========================================================================
echo    BLE-Based Smart College Attendance Management System (Hackathon)
echo =========================================================================
echo.
echo Starting Backend API Server (Port 5000)...
start "Attendance Backend API" cmd /k "cd /d %~dp0backend && node server.js"

timeout /t 3 /nobreak >nul

echo Starting Frontend Web Portal (Vite on http://localhost:5173)...
start "Attendance Frontend Web" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo System started!
echo - Frontend: http://localhost:5173
echo - Backend:  http://localhost:5000
echo - Health:   http://localhost:5000/api/health
echo =========================================================================
pause
