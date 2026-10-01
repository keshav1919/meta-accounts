#!/usr/bin/env bash
# Linux / Ubuntu RDP & VPS Launcher for META ACCOUNTS BOT

set -e

echo "========================================================="
echo "      META ACCOUNTS TELEGRAM BOT - LINUX RUNNER"
echo "========================================================="
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not installed. Please install Node.js v18 or v20."
    exit 1
fi

# Check .env
if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        echo "[INFO] Creating .env from .env.example..."
        cp .env.example .env
        echo "[!] Please configure your .env file before launching."
        exit 1
    fi
fi

# Install dependencies if missing
if [ ! -d node_modules ]; then
    echo "[INFO] Installing dependencies..."
    npm install --omit=dev
fi

# Sync Prisma Schema
echo "[INFO] Syncing database schema via Prisma..."
npx prisma db push

echo ""
echo "========================================================="
echo "[SUCCESS] Starting Bot with low memory footprint (256MB)..."
echo "========================================================="
echo ""

# Start with aggressive garbage collection and auto-restart loop
while true; do
    node --max-old-space-size=256 src/server.js
    echo "[WARNING] Bot process exited. Restarting in 3 seconds..."
    sleep 3
done
