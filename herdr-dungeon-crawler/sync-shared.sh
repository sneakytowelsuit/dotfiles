#!/bin/sh
# Mods can't import across folders, so the modules several mods share live in
# mods/dcc-crawlers/ and are copied into the mods that use them. Run this after
# editing floors.js, scene.js, cast.js or avatar.js there.
cd "$(dirname "$0")/mods" || exit 1
for m in dcc-bar dcc-scene dcc-floors dcc-status dcc-system; do cp dcc-crawlers/floors.js "$m/"; done
for m in dcc-scene dcc-floors; do cp dcc-crawlers/scene.js "$m/"; done
for m in dcc-system dcc-pane; do cp dcc-crawlers/cast.js "$m/"; done
cp dcc-crawlers/avatar.js dcc-pane/
echo "shared modules synced"
