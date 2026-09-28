#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if ! command -v brew >/dev/null 2>&1; then
    if [[ -x /home/linuxbrew/.linuxbrew/bin/brew ]]; then
        eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"
    else
        printf 'Homebrew is missing. Install Homebrew for Linux, then retry.\n' >&2
        exit 1
    fi
fi

# Bundle normally upgrades existing formulae; this command only adds missing ones.
brew bundle install --no-upgrade --file "$root/packages/Brewfile"

if [[ -s "$root/packages/flatpaks.txt" ]]; then
    if ! command -v flatpak >/dev/null 2>&1; then
        printf 'Flatpak is missing; cannot apply packages/flatpaks.txt.\n' >&2
        exit 1
    fi
    remote_ready=false
    while IFS= read -r app_id || [[ -n "$app_id" ]]; do
        [[ -z "$app_id" || "$app_id" == \#* ]] && continue
        if flatpak info "$app_id" >/dev/null 2>&1; then
            continue
        fi
        if [[ "$remote_ready" == false ]]; then
            flatpak remote-add --user --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo
            remote_ready=true
        fi
        flatpak install --user --noninteractive flathub "$app_id"
    done < "$root/packages/flatpaks.txt"
fi

if ! command -v stow >/dev/null 2>&1; then
    printf 'GNU Stow is missing after Brewfile application.\n' >&2
    exit 1
fi

packages=()
while IFS= read -r package || [[ -n "$package" ]]; do
    [[ -z "$package" || "$package" == \#* ]] && continue
    if [[ ! -d "$root/dotfiles/$package" ]]; then
        printf 'Missing Stow package: %s\n' "$package" >&2
        exit 1
    fi
    packages+=("$package")
done < "$root/packages/stow.txt"

if (( ${#packages[@]} > 0 )); then
    stow --restow --no --verbose --dir "$root/dotfiles" --target "$HOME" "${packages[@]}"
    stow --restow --dir "$root/dotfiles" --target "$HOME" "${packages[@]}"
fi

printf 'Brew, Flatpak, and Stow declarations are applied.\n'
