@echo off
title QRMenu POS Bridge
cd /d "%~dp0"

if not exist "node_modules" (
  echo Installing dependencies...
  call npm install
)

echo.
echo Starting QRMenu POS Bridge...
echo.
node server.js

pause
