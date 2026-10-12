#!/usr/bin/env bash
# Builds the iOS development app for a simulator and installs it.
#
#   scripts/build-ios.sh                 # the booted simulator, else the first iPhone
#   scripts/build-ios.sh "iPhone 17"     # a simulator by name or UDID
#
# Why not `expo run:ios`: with the iOS 27 simulator it takes the simulator for a physical device and asks for
# code signing. Why this script and not a bare xcodebuild: a cold build compiles ~1,000 C/C++ files (Reanimated,
# Screens, SVG, MMKV, Firebase's SwiftPM packages) and takes up to half an hour. Xcode's compilation cache is
# content-addressed, so with it on and kept OUTSIDE ios/ (which `expo prebuild --clean` deletes), a build after a
# clean, a prebuild or a fresh derived-data folder replays those compiles instead of redoing them.
set -euo pipefail

cd "$(dirname "$0")/.."
export LANG=en_US.UTF-8

CACHE_ROOT="${KLNDR_IOS_CACHE:-$HOME/Library/Caches/klndr-ios}"
DERIVED_DATA="$CACHE_ROOT/derived-data"
CAS_PATH="$CACHE_ROOT/compilation-cache"
mkdir -p "$DERIVED_DATA" "$CAS_PATH"

if [ ! -d ios/klndr.xcworkspace ]; then
  echo "No ios/ project yet: generating it (expo prebuild + pod install)…"
  npx expo prebuild --platform ios --no-install
  (cd ios && pod install)
fi

target="${1:-}"
if [ -z "$target" ]; then
  target="$(xcrun simctl list devices booted -j | python3 -I -c 'import json,sys; d=[x for r in json.load(sys.stdin)["devices"].values() for x in r]; print(d[0]["udid"] if d else "")')"
fi
if [ -z "$target" ]; then
  target="$(xcrun simctl list devices available -j | python3 -I -c 'import json,sys; d=[x for r in json.load(sys.stdin)["devices"].values() for x in r if x["name"].startswith("iPhone")]; print(d[0]["udid"] if d else "")')"
fi
[ -n "$target" ] || { echo "No iPhone simulator found." >&2; exit 1; }

# A name is turned into its UDID.
udid="$(xcrun simctl list devices available -j | python3 -I -c 'import json,sys; t=sys.argv[1]; d=[x for r in json.load(sys.stdin)["devices"].values() for x in r if t in (x["udid"], x["name"])]; print(d[0]["udid"] if d else "")' "$target")"
[ -n "$udid" ] || { echo "No simulator called '$target'." >&2; exit 1; }

xcrun simctl boot "$udid" 2>/dev/null || true

start=$SECONDS
xcodebuild -workspace ios/klndr.xcworkspace -scheme klndr -configuration Debug \
  -destination "id=$udid" -derivedDataPath "$DERIVED_DATA" \
  COMPILATION_CACHE_ENABLE_CACHING=YES COMPILATION_CACHE_CAS_PATH="$CAS_PATH" \
  CODE_SIGNING_ALLOWED=NO build | tail -n 3
echo "Built in $((SECONDS - start))s."

app="$DERIVED_DATA/Build/Products/Debug-iphonesimulator/klndr.app"
xcrun simctl install "$udid" "$app"
echo "Installed on $udid. Start Metro with: npx expo start --dev-client"
