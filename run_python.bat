@echo off
title META ACCOUNTS BOT [Python Edition - RDP Runner]
color 0A

echo =========================================================
echo       META ACCOUNTS TELEGRAM BOT - PYTHON EDITION
echo =========================================================
echo.

:: 1. Check Python
where python >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Python is not installed or not in system PATH!
    echo Please install Python 3.10+ from https://www.python.org/
    echo Make sure to check "Add Python to PATH" during installation.
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

:: 3. Install Python dependencies
echo [INFO] Installing / verifying Python dependencies...
python -m pip install -r requirements.txt --quiet
if %errorlevel% neq 0 (
    echo [WARNING] Dependency install had issues. Attempting to proceed...
)

echo.
echo =========================================================
echo [SUCCESS] Starting Telegram Bot (Python Edition)...
echo [INFO] Press Ctrl+C to stop the bot.
echo =========================================================
echo.

:LOOP
python main.py
echo.
echo [WARNING] Bot stopped unexpectedly! Restarting in 3 seconds...
timeout /t 3 /nobreak >nul
goto LOOP
