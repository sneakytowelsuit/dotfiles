#!/usr/bin/env bash
set -euo pipefail

zsh_path="$(command -v zsh || true)"
if [[ -z "$zsh_path" ]]; then
    printf 'Host Zsh is not installed; keeping the current login shell.\n' >&2
    exit 0
fi

zsh_path="$(readlink -f "$zsh_path")"
if [[ "$zsh_path" != /usr/bin/zsh ]]; then
    printf 'Zsh is not the host copy at /usr/bin/zsh; keeping the current login shell.\n' >&2
    exit 0
fi

user_name="$(id -un)"
current_shell="$(getent passwd "$user_name" | cut -d: -f7)"
if [[ -z "$current_shell" ]]; then
    printf 'Could not determine the login shell for %s.\n' "$user_name" >&2
    exit 1
fi

if [[ "$(readlink -f "$current_shell")" == "$zsh_path" ]]; then
    exit 0
fi

if command -v chsh >/dev/null 2>&1; then
    chsh -s "$zsh_path"
else
    # Aurora omits chsh (from util-linux-user), but includes usermod. Use the
    # system administration interface rather than layering another host RPM.
    usermod_path="$(command -v usermod || true)"
    if [[ -z "$usermod_path" && -x /usr/sbin/usermod ]]; then
        usermod_path=/usr/sbin/usermod
    fi
    if [[ -z "$usermod_path" ]] || ! command -v sudo >/dev/null 2>&1; then
        printf 'Cannot change the login shell: neither chsh nor sudo usermod is available.\n' >&2
        exit 1
    fi
    sudo "$usermod_path" --shell "$zsh_path" "$user_name"
fi

updated_shell="$(getent passwd "$user_name" | cut -d: -f7)"
if [[ "$(readlink -f "$updated_shell")" != "$zsh_path" ]]; then
    printf 'Login shell update did not take effect for %s (still %s).\n' "$user_name" "$updated_shell" >&2
    exit 1
fi

printf 'Login shell changed to Zsh. Log out and back in to use it.\n'
