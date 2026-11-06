#!/usr/bin/env bash
set -euo pipefail

# The TUI is managed by mise's brew:herdr package declaration. The desktop
# app and core use upstream's user installers and manage their own updates.
export PATH="$HOME/.local/bin:$PATH"
download_dir=""
trap '[[ -z "$download_dir" ]] || rm -rf "$download_dir"' EXIT

install_component() {
    local component="$1" executable="$2"
    if command -v "$executable" >/dev/null 2>&1; then
        printf '%s is already installed; leaving it in place.\n' "$executable"
        return
    fi

    [[ -n "$download_dir" ]] || download_dir="$(mktemp -d)"
    local installer="$download_dir/$component.sh"
    curl --fail --silent --show-error --location --retry 3 \
        "https://releases.herdr.dev/$component/install.sh" --output "$installer"
    sh -n "$installer"
    sh "$installer"
    if ! command -v "$executable" >/dev/null 2>&1; then
        printf 'Herdr %s installer did not provide %s.\n' "$component" "$executable" >&2
        exit 1
    fi
}

# An unrelated window-manager utility may also be called hc. Check the
# unambiguous binary, and let upstream avoid replacing an existing hc.
# Install core explicitly: the app installer treats a core failure as optional.
install_component core herdr-core
install_component app herdr-app
