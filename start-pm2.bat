@echo off
title META ACCOUNTS BOT [PM2 Background Runner]
color 0B

echo =========================================================
echo       META ACCOUNTS BOT - PM2 24/7 BACKGROUND RUNNER
echo =========================================================
echo.

where pm2 >nul 2>nul
if %errorlevel% neq 0 (
    echo [INFO] PM2 not found globally. Installing pm2...
    call npm install -g pm2
)

echo [INFO] Ensuring database schema is synced...
call npx prisma db push

echo [INFO] Starting Bot under PM2 with low memory limit (256MB)...
call pm2 start ecosystem.config.js
call pm2 save

echo.
echo =========================================================
echo [SUCCESS] Bot is now running in the background 24/7!
echo.
echo Useful commands:
echo   pm2 status          - Check bot status
echo   pm2 logs            - View live bot logs
echo   pm2 restart all     - Restart bot
echo   pm2 stop all        - Stop bot
echo =========================================================
echo.
call pm2 status
pause
