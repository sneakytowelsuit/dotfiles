# Imported by Aurora's /usr/share/ublue-os/just/00-entry.just.
workstation-sync:
    #!/usr/bin/env bash
    set -euo pipefail
    repo="${WORKSTATION_REPO:-$HOME/.local/share/workstation/repo}"
    if [[ ! -x "$repo/bootstrap/sync.sh" ]]; then
        printf 'Workstation repository not registered. Run bootstrap/setup.sh or set WORKSTATION_REPO.\n' >&2
        exit 1
    fi
    "$repo/bootstrap/sync.sh"

# Review explicitly installed Homebrew packages that are not in the Brewfile.
workstation-capture-brew:
    #!/usr/bin/env bash
    set -euo pipefail
    repo="${WORKSTATION_REPO:-$HOME/.local/share/workstation/repo}"
    if [[ ! -x "$repo/bootstrap/capture-brew.sh" ]]; then
        printf 'Workstation repository not registered. Run bootstrap/setup.sh or set WORKSTATION_REPO.\n' >&2
        exit 1
    fi
    "$repo/bootstrap/capture-brew.sh"
