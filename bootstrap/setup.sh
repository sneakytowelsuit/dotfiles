#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if ! command -v bootc >/dev/null 2>&1; then
    printf 'This setup expects an Aurora/bootc workstation.\n' >&2
    exit 1
fi

state_dir="$HOME/.local/share/workstation"
repo_link="$state_dir/repo"
mkdir -p "$state_dir"
if [[ -e "$repo_link" || -L "$repo_link" ]]; then
    if [[ "$(readlink -f "$repo_link")" != "$root" ]]; then
        printf 'Repository link %s points elsewhere. Review it before retrying.\n' "$repo_link" >&2
        exit 1
    fi
else
    ln -s "$root" "$repo_link"
fi

"$root/bootstrap/sync.sh"

if command -v mise >/dev/null 2>&1; then
    mise install
fi

zsh_path="$(command -v zsh || true)"
current_shell="$(getent passwd "$USER" | cut -d: -f7)"
if [[ -n "$zsh_path" && "$current_shell" != "$zsh_path" ]]; then
    if [[ "$zsh_path" == /usr/bin/zsh || "$zsh_path" == /bin/zsh ]]; then
        chsh -s "$zsh_path"
        printf 'Log out and back in to use Zsh as the login shell.\n'
    else
        printf 'Zsh is not a recognized host shell; keeping the current login shell.\n' >&2
    fi
fi

printf 'Setup complete. Select Niri in SDDM; Plasma remains the fallback.\n'
