# Water Station V40 — Capacitor Android

This is the Capacitor version of the Water Station POS. It does **not** depend on
Netlify or PWABuilder. The UI is bundled inside a native Android application.

## What is native in this build

- Native Android application container (no browser address bar)
- Android back-button behavior
- Haptic feedback for product taps, quantity buttons, payment, sale confirmation and shift handoff
- Native splash screen + launcher assets
- Modern Android system-bar / safe-area handling
- Keyboard-aware bottom navigation
- All V39 POS functions and local data behavior are retained

## Windows — easiest setup

Requirements:
1. Node.js 22+
2. Android Studio 2025.2.1 or newer
3. Android SDK installed through Android Studio

Then:
1. Extract this ZIP.
2. Double-click `SETUP_ANDROID_WINDOWS.bat`.
3. Wait for Android Studio to open and finish Gradle sync.
4. Connect an Android phone with USB debugging enabled, or start an emulator.
5. Press the Run button in Android Studio.

## Create a test APK

After setup, double-click:
`BUILD_DEBUG_APK_WINDOWS.bat`

The script creates:
`WaterStation-V40-debug.apk`

You can install that APK directly on an Android phone for testing.

## Create a signed release APK

In Android Studio:
1. Build
2. Generate Signed App Bundle or APK
3. Choose APK
4. Choose module `app`
5. Create/select your keystore
6. Choose release

Keep the same keystore permanently if you want future updates to install over the same app.

## Updating the POS later

Replace/update `index.html` and the source files, then run:
`SYNC_CHANGES_WINDOWS.bat`

After sync, rebuild the APK in Android Studio.

## Important data note

The POS data is stored locally in the app's WebView storage. Uninstalling the app
or clearing its Android app storage can remove that local data, so export a backup
before uninstalling or clearing storage.
