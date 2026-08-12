#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

echo "Water Station V40 - Capacitor Android"
npm install
npm run build
if [ ! -d android ]; then
  npx cap add android
fi
npx capacitor-assets generate --android
npx cap sync android
npx cap open android
