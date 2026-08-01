@echo off
title Jutts Bot
color 0A
cls

echo ============================================
echo    Jutts Bot - Starting...
echo ============================================
echo.

cd /d "c:\Users\MS NAEEM\AA-MD-Bot\AA-MD-Bot"

echo Creating MongoDB data directory if not exists...
if not exist "c:\data\db" mkdir "c:\data\db"

echo Starting MongoDB in background...
start /min "MongoDB" mongod --dbpath "c:\data\db" --logpath "c:\data\db\mongod.log" --quiet
timeout /t 3 /nobreak >nul

echo [OK] MongoDB started
echo.
echo Starting Jutts Bot in background...
start /min "Jutts Bot" node index.js
timeout /t 5 /nobreak >nul

echo [OK] Bot started
echo.
echo Opening dashboard in browser...
start http://localhost:5000

echo.
echo ============================================
echo    Bot is running in background
echo    Dashboard: http://localhost:5000
echo    Press any key to stop the bot...
echo ============================================
pause

echo.
echo Stopping bot...
taskkill /FI "WINDOWTITLE eq Jutts Bot*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq MongoDB*" /F >nul 2>&1
echo [OK] Bot stopped
timeout /t 2 /nobreak >nul
