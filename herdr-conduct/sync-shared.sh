#!/bin/sh
set -e
# Mods can't import across folders: attn.js lives in conduct-bar/ and is copied to the others.
cd "$(dirname "$0")/mods" || exit 1
for m in conduct-queue conduct-pane conduct-menu conduct-send conduct-triage conduct-settings conduct-tabs conduct-feed conduct-alerts conduct-snooze conduct-recover conduct-usage conduct-map conduct-batch conduct-jump; do mkdir -p "$m"; cp conduct-bar/attn.js "$m/"; done

for m in conduct-triage conduct-settings conduct-usage; do cp conduct-bar/keys.js "$m/"; done
# feed + alerts: conduct-feed is the source for feed.js, alerts.js and observe.js
for m in conduct-queue conduct-bar; do cp conduct-feed/feed.js "$m/"; done
for m in conduct-queue conduct-alerts; do cp conduct-feed/alerts.js "$m/"; done
cp conduct-feed/observe.js conduct-queue/
# snooze + recovery: sources live in conduct-snooze / conduct-recover
cp conduct-snooze/snooze.js conduct-queue/
cp conduct-recover/recover.js conduct-recover/recover-actions.js conduct-queue/
# usage: conduct-usage is the source for usage.js, usage-poll.js and health.js
for m in conduct-queue conduct-pane conduct-bar; do cp conduct-usage/usage.js conduct-usage/usage-poll.js conduct-usage/health.js "$m/"; done
# glyphs (shape as well as colour), recent history (jump / previous agent), density, form parser for batch
for m in conduct-map conduct-bar conduct-queue conduct-pane conduct-tabs conduct-triage; do cp conduct-glyphs/glyphs.js "$m/"; done
# attn.js imports recent.js, so every mod that has a copy of attn.js needs one too
for d in */; do [ "$d" != "conduct-bar/" ] && [ -f "$d/attn.js" ] && cp conduct-bar/recent.js "$d"; done
cp conduct-triage/form.js conduct-batch/
for m in conduct-settings conduct-queue conduct-tabs conduct-triage; do cp conduct-density/density.js "$m/"; done
# Harness adapters are plain sibling modules because Herdr isolates mod imports by folder.
for m in conduct-glyphs conduct-map conduct-bar conduct-queue conduct-pane conduct-tabs conduct-triage conduct-batch conduct-usage conduct-recover; do
  cp conduct-harnesses/harnesses.js conduct-harnesses/prompts.js conduct-harnesses/session.js "$m/" || exit 1
done
echo "shared modules synced"
