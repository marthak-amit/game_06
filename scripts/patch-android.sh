#!/usr/bin/env bash
# Applies icons, splash, portrait lock and the AdMob app id to the generated android/ project.
set -euo pipefail
RES=android/app/src/main/res
MANIFEST=android/app/src/main/AndroidManifest.xml
cp -r resources/android/* "$RES/"
find "$RES" -name 'splash*.png' -exec cp resources/splash.png {} \;
# solid dark adaptive-icon background
for f in "$RES"/values/ic_launcher_background.xml; do [ -f "$f" ] && sed -i 's|#[0-9A-Fa-f]\{6\}|#1B1450|' "$f"; done
APPID=$(cat native/admob-app-id.txt)
if ! grep -q 'gms.ads.APPLICATION_ID' "$MANIFEST"; then
  sed -i "s|</application>|    <meta-data android:name=\"com.google.android.gms.ads.APPLICATION_ID\" android:value=\"$APPID\"/>\n    </application>|" "$MANIFEST"
fi
sed -i 's|<activity|<activity android:screenOrientation="portrait"|' "$MANIFEST"
echo "patched; AdMob app id: $APPID"
