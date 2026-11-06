#!/usr/bin/env bash
set -euo pipefail

# Compatibility entry point for older workstation images.
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="$HOME/.local/bin:/usr/local/bin:/home/linuxbrew/.linuxbrew/bin:$PATH"
printf 'Previewing formulae to import into mise.toml (casks are declared manually).\n'
mise -C "$root" bootstrap packages import --path "$root/mise.toml" --dry-run
printf '\nTo record these formulae, run:\n  mise -C %q bootstrap packages import --path %q\n' "$root" "$root/mise.toml"
