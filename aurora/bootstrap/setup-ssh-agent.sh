#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${XDG_RUNTIME_DIR:-}" ]] || ! command -v systemctl >/dev/null 2>&1; then
    printf 'No systemd user session; rerun sync from a logged-in Aurora session to enable the SSH agent.\n'
    exit 0
fi

# Aurora's OpenSSH package supplies these socket-activated user units. Reuse
# them so every terminal and desktop app shares one agent without shell daemons.
systemctl --user daemon-reload
systemctl --user enable --now ssh-agent.socket
export SSH_AUTH_SOCK="$XDG_RUNTIME_DIR/ssh-agent.socket"
systemctl --user set-environment "SSH_AUTH_SOCK=$SSH_AUTH_SOCK"
if command -v dbus-update-activation-environment >/dev/null 2>&1; then
    dbus-update-activation-environment SSH_AUTH_SOCK
fi

printf 'Shared SSH agent enabled at %s.\n' "$SSH_AUTH_SOCK"
printf 'Unlock your key in a terminal with: SSH_AUTH_SOCK="%s" ssh-add ~/.ssh/id_ed25519\n' "$SSH_AUTH_SOCK"
printf 'Sign out and back in so existing desktop applications inherit the shared agent.\n'
