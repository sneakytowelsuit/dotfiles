#!/bin/sh
# Mods can't import across folders: attn.js lives in conduct-bar/ and is copied to the others.
cd "$(dirname "$0")/mods" || exit 1
for m in conduct-queue conduct-pane conduct-menu conduct-send conduct-triage conduct-settings conduct-tabs; do mkdir -p "$m"; cp conduct-bar/attn.js "$m/"; done

for m in conduct-triage conduct-settings; do cp conduct-bar/keys.js "$m/"; done
echo "shared modules synced"
