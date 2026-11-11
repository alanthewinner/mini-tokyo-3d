@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Kansha Tokyo
where npm >nul 2>nul || (echo [!] Node.js not found. Install it first: winget install OpenJS.NodeJS.LTS & pause & exit /b 1)
if not exist node_modules (
  echo First run: installing packages, this takes a few minutes...
  call npm install || (pause & exit /b 1)
)
if not exist .env echo [!] .env not found - the map will be blank until you add MAPBOX_ACCESS_TOKEN.
start "" cmd /c "timeout /t 20 /nobreak >nul & start http://localhost:9966"
echo Starting... browser opens in about 20 seconds. Close this window to stop.
call npm run dev
pause
