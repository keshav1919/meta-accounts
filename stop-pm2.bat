@echo off
title Stop META ACCOUNTS BOT
color 0C

echo Stopping META ACCOUNTS BOT...
call pm2 stop meta-acc-bot
call pm2 delete meta-acc-bot
call pm2 save
echo Bot stopped and removed from PM2.
pause
