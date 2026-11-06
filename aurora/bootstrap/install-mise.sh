#!/usr/bin/env bash
set -euo pipefail

# Also used by the image build. Keep this version aligned with CI.
version=2026.10.18
destination="${1:-$HOME/.local/bin/mise}"
case "$(uname -m)" in
    x86_64) architecture=x64 ;;
    aarch64) architecture=arm64 ;;
    *) printf 'Unsupported mise architecture.\n' >&2; exit 1 ;;
esac
asset="mise-v${version}-linux-${architecture}"
download_dir="$(mktemp -d)"
trap 'rm -rf "$download_dir"' EXIT
url="https://github.com/jdx/mise/releases/download/v${version}"
curl --fail --silent --show-error --location --retry 3 "$url/$asset" --output "$download_dir/$asset"
curl --fail --silent --show-error --location --retry 3 "$url/SHASUMS256.txt" --output "$download_dir/SHASUMS256.txt"
(
    cd "$download_dir"
    awk -v asset="$asset" '$2 == asset || $2 == "./" asset { print; found=1 } END { if (!found) exit 1 }' SHASUMS256.txt > checksum
    sha256sum --check checksum
)
install -Dm755 "$download_dir/$asset" "$destination"
"$destination" --version
