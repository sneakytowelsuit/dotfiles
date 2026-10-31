# Imported by Aurora's /usr/share/ublue-os/just/00-entry.just.
workstation-sync:
    #!/usr/bin/env bash
    set -euo pipefail
    repo="${WORKSTATION_REPO:-$HOME/.local/share/workstation/repo}"
    if [[ ! -e "$repo" && -z "${WORKSTATION_REPO:-}" ]]; then
        repo=/usr/share/workstation
    fi
    if [[ ! -x "$repo/bootstrap/sync.sh" ]]; then
        printf 'Workstation repository not registered. Run bootstrap/setup.sh or set WORKSTATION_REPO.\n' >&2
        exit 1
    fi
    "$repo/bootstrap/sync.sh"

# Apply the configuration bundled with the booted image, without changing the
# registered editable checkout. Useful when testing a feature-branch image.
workstation-image-sync:
    bash /usr/share/workstation/bootstrap/sync.sh

# Preview importing explicitly installed Homebrew formulae into mise.toml.
workstation-capture-brew:
    #!/usr/bin/env bash
    set -euo pipefail
    repo="${WORKSTATION_REPO:-$HOME/.local/share/workstation/repo}"
    if [[ ! -x "$repo/bootstrap/capture-brew.sh" ]]; then
        printf 'Workstation repository not registered. Run bootstrap/setup.sh or set WORKSTATION_REPO.\n' >&2
        exit 1
    fi
    "$repo/bootstrap/capture-brew.sh"
