#!/bin/zsh
set -euo pipefail

project_dir="$(cd "$(dirname "$0")/.." && pwd)"
app_path="$project_dir/src-tauri/target/release/bundle/macos/SocialFlow OS.app"
archive_path="$project_dir/src-tauri/target/release/bundle/macos/SocialFlow-OS-notarization.zip"

if [[ -z "${APPLE_SIGN_IDENTITY:-}" ]]; then
  print -u2 "Set APPLE_SIGN_IDENTITY to your Developer ID Application certificate name."
  exit 2
fi

if [[ -z "${APPLE_NOTARY_PROFILE:-}" ]]; then
  print -u2 "Set APPLE_NOTARY_PROFILE to a notarytool Keychain profile created with xcrun notarytool store-credentials."
  exit 2
fi

if [[ ! -d "$app_path" ]]; then
  print -u2 "Build the app first with npm run desktop:build."
  exit 2
fi

codesign --force --deep --options runtime --timestamp --sign "$APPLE_SIGN_IDENTITY" "$app_path"
codesign --verify --deep --strict --verbose=2 "$app_path"
ditto -c -k --keepParent "$app_path" "$archive_path"
xcrun notarytool submit "$archive_path" --keychain-profile "$APPLE_NOTARY_PROFILE" --wait
xcrun stapler staple "$app_path"
xcrun stapler validate "$app_path"

print "Signed and notarized app: $app_path"
