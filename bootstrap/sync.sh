#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if (( $# > 1 )) || [[ $# == 1 && "$1" != --dry-run ]]; then
    printf 'Usage: %s [--dry-run]\n' "$0" >&2
    exit 1
fi
export PATH="$HOME/.local/bin:/usr/local/bin:/home/linuxbrew/.linuxbrew/bin:$PATH"
if ! command -v mise >/dev/null 2>&1; then
    bash "$root/bootstrap/install-mise.sh"
fi

# Project configuration must be trusted explicitly; no shell hook applies it.
mise trust "$root/mise.toml"
if [[ "${1:-}" == --dry-run ]]; then
    python3 "$root/bootstrap/migrate-stow.py" --root "$root" --dry-run
    mise -C "$root" bootstrap --dry-run
    exit 0
fi

# Only remove links made by this repo's previous Stow layout, never user files.
python3 "$root/bootstrap/migrate-stow.py" --root "$root"
# Restore the home links before package downloads, so a network/package error
# cannot leave migrated shell configuration missing.
mise -C "$root" dotfiles apply
if command -v flatpak >/dev/null 2>&1; then
    flatpak remote-add --user --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo
fi
mise -C "$root" bootstrap
printf 'Workstation packages, dotfiles, tools, and desktop defaults are applied.\n'
