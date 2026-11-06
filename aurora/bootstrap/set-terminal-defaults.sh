#!/usr/bin/env bash
set -euo pipefail

# User sync may run before the updated host image has been installed.
if ! command -v ghostty >/dev/null 2>&1; then
    printf 'Ghostty is not installed; keeping the current KDE terminal default. Boot the updated workstation image and rerun sync.\n'
    exit 0
fi

if ! command -v kwriteconfig6 >/dev/null 2>&1; then
    printf 'kwriteconfig6 is unavailable; cannot set the KDE terminal default.\n' >&2
    exit 1
fi

# Update only these keys; KDE and Noctalia manage the rest of kdeglobals.
kwriteconfig6 --file kdeglobals --group General --key TerminalApplication ghostty
kwriteconfig6 --file kdeglobals --group General --key TerminalService com.mitchellh.ghostty.desktop

printf 'KDE terminal default set to Ghostty.\n'
