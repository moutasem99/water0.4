# Build the Android APK without Android Studio

This project is ready for GitHub Actions cloud building.

## You need
- A GitHub account
- A web browser

Android Studio is NOT required on your laptop for this workflow.

## One-time setup

1. Go to GitHub and create a new repository.
2. Keep it empty (do not add README / .gitignore from GitHub).
3. Extract this ZIP on your computer.
4. Open the extracted `water_station_v55_dark_mode` folder.
5. Upload **all files and folders inside it** to the root of your GitHub repository.
   Make sure `.github/workflows/build-android-apk.yml` is included.
6. Commit the files to the `main` branch.

Because the workflow also runs on pushes to `main`, the first build may start automatically.

## Run a build manually

1. Open your GitHub repository.
2. Click **Actions**.
3. Click **Build Android APK**.
4. Click **Run workflow**.
5. Choose `main`.
6. Click the green **Run workflow** button.
7. Wait for the workflow to finish.

## Download the APK

1. Open the completed workflow run.
2. Scroll to the **Artifacts** section.
3. Download **WaterStation-V41-APK**.
4. Extract the downloaded artifact ZIP.
5. Inside it is:
   `WaterStation-V41-debug.apk`

Install that APK on your Android phone.

## Future app updates

When the app is updated:
1. Replace the changed project files in GitHub.
2. Commit to `main`.
3. GitHub builds a new APK automatically.

## Important

This workflow creates a DEBUG APK for direct testing/installation.
For Play Store distribution or permanent production releases, use a signed release
APK/AAB with a permanent keystore. That can also be automated later using GitHub
Actions secrets, without Android Studio.
