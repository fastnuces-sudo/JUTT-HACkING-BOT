@echo off
setlocal
title Jutts Bot
color 0A
cd /d "%~dp0"

echo ============================================
echo    Jutts Bot - Starting...
echo ============================================
echo.

where node >nul 2>&1 || (
  echo [ERROR] Node.js 20 or newer is required.
  echo Download it from https://nodejs.org/
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Installing dependencies...
  call npm ci
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
  )
)

if not exist ".env" (
  copy /y ".env.example" ".env" >nul
  echo [NOTICE] Created .env from .env.example.
  echo Configure MONGODB_URI for database persistence.
  echo.
)

start "" "http://localhost:5000"
echo Dashboard: http://localhost:5000
echo Press Ctrl+C to stop the bot.
echo.
call npm start

endlocal
