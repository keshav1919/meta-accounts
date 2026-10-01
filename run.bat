@echo off
title META ACCOUNTS BOT [High-Performance RDP Runner]
color 0A

echo =========================================================
echo       META ACCOUNTS TELEGRAM BOT - RDP RUNNER
echo =========================================================
echo.

:: 1. Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Node.js is not installed or not in PATH!
    echo Please install Node.js v18 or v20 from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: 2. Check .env file
if not exist ".env" (
    echo [INFO] .env file not found. Creating from .env.example...
    if exist ".env.example" (
        copy .env.example .env
        echo [!] Please configure your .env file with your DATABASE_URL and BOT_TOKEN.
        pause
    ) else (
        echo [ERROR] Neither .env nor .env.example found!
        pause
        exit /b 1
    )
)

:: 3. Check dependencies
if not exist "node_modules\" (
    echo [INFO] Installing required dependencies...
    call npm install --omit=dev
    if %errorlevel% neq 0 (
        echo [ERROR] npm install failed.
        pause
        exit /b 1
    )
)

:: 4. Sync Prisma Database Schema
echo [INFO] Syncing database schema via Prisma...
call npx prisma db push
if %errorlevel% neq 0 (
    echo [WARNING] Prisma db push had warnings/issues. Continuing to launch...
)

echo.
echo =========================================================
echo [SUCCESS] Starting Telegram Bot with auto-restart...
echo [INFO] Press Ctrl+C in this window to stop the bot.
echo =========================================================
echo.

:LOOP
node --max-old-space-size=256 src/server.js
echo.
echo [WARNING] Bot stopped unexpectedly! Restarting in 3 seconds...
timeout /t 3 /nobreak >nul
goto LOOP
