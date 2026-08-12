@echo off
setlocal
cd /d "%~dp0"

echo.
echo ==========================================
echo   Water Station V40 - Capacitor Android
echo ==========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js 22 or newer is required.
  echo Install Node.js, then run this file again.
  pause
  exit /b 1
)

echo [1/6] Installing npm packages...
call npm install
if errorlevel 1 goto :error

echo [2/6] Building the web application...
call npm run build
if errorlevel 1 goto :error

if not exist "android" (
  echo [3/6] Creating native Android project...
  call npx cap add android
  if errorlevel 1 goto :error
) else (
  echo [3/6] Android project already exists.
)

echo [4/6] Generating native icons and splash screen...
call npx capacitor-assets generate --android
if errorlevel 1 goto :error

echo [5/6] Syncing Capacitor...
call npx cap sync android
if errorlevel 1 goto :error

echo [6/6] Opening Android Studio...
call npx cap open android
if errorlevel 1 goto :error

echo.
echo Setup complete.
exit /b 0

:error
echo.
echo Setup stopped because a command failed.
pause
exit /b 1
