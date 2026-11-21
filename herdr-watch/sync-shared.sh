#!/bin/sh
# Mods can't import across folders: attn.js lives in watch-bar/ and is copied to the others.
cd "$(dirname "$0")/mods" || exit 1
for m in watch-queue watch-pane watch-menu; do cp watch-bar/attn.js "$m/"; done
echo "shared modules synced"
