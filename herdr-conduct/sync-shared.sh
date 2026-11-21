#!/bin/sh
# Mods can't import across folders: attn.js lives in conduct-bar/ and is copied to the others.
cd "$(dirname "$0")/mods" || exit 1
for m in conduct-queue conduct-pane conduct-menu conduct-send conduct-triage conduct-settings conduct-tabs conduct-feed conduct-alerts; do mkdir -p "$m"; cp conduct-bar/attn.js "$m/"; done

for m in conduct-triage conduct-settings; do cp conduct-bar/keys.js "$m/"; done
# feed + alerts: conduct-feed is the source for feed.js, alerts.js and observe.js
for m in conduct-queue conduct-bar; do cp conduct-feed/feed.js "$m/"; done
for m in conduct-queue conduct-alerts; do cp conduct-feed/alerts.js "$m/"; done
cp conduct-feed/observe.js conduct-queue/
echo "shared modules synced"
