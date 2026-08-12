@echo off
setlocal
cd /d "%~dp0"

if not exist "android" (
  echo Android project not found.
  echo Run SETUP_ANDROID_WINDOWS.bat first.
  pause
  exit /b 1
)

call npm run build
if errorlevel 1 goto :error

call npx cap sync android
if errorlevel 1 goto :error

cd android
call gradlew.bat assembleDebug
if errorlevel 1 goto :error

cd ..
copy /Y "android\app\build\outputs\apk\debug\app-debug.apk" "WaterStation-V40-debug.apk" >nul

echo.
echo APK created:
echo %CD%\WaterStation-V40-debug.apk
pause
exit /b 0

:error
echo Build failed.
pause
exit /b 1
