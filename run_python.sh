#!/usr/bin/env bash
# Linux / Ubuntu Launcher for META ACCOUNTS BOT (Python Edition)

set -e

echo "========================================================="
echo "      META ACCOUNTS TELEGRAM BOT - PYTHON EDITION"
echo "========================================================="
echo ""

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "[ERROR] Python 3 is not installed. Please install python3 and python3-pip."
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

# Install dependencies
echo "[INFO] Installing Python dependencies..."
python3 -m pip install -r requirements.txt --quiet

echo ""
echo "========================================================="
echo "[SUCCESS] Starting Bot with Auto-Restart..."
echo "========================================================="
echo ""

while true; do
    python3 main.py
    echo "[WARNING] Bot process exited. Restarting in 3 seconds..."
    sleep 3
done
