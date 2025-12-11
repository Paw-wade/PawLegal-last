@echo off
echo Liberation du port 3004...
powershell -ExecutionPolicy Bypass -File scripts\pre-dev.ps1 -Port 3004
timeout /t 1 /nobreak >nul

