@echo off
setlocal
cd /d "%~dp0"
call npm run build
if errorlevel 1 goto :error
call npx cap sync android
if errorlevel 1 goto :error
echo Updated web app copied into Android project.
pause
exit /b 0
:error
echo Sync failed.
pause
exit /b 1
