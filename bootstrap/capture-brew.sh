#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
brewfile="$root/packages/Brewfile"

if ! command -v brew >/dev/null 2>&1; then
    if [[ -x /home/linuxbrew/.linuxbrew/bin/brew ]]; then
        eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"
    else
        printf 'Homebrew is missing. Install Homebrew for Linux, then retry.\n' >&2
        exit 1
    fi
fi

if [[ ! -f "$brewfile" ]]; then
    printf 'Brewfile is missing: %s\n' "$brewfile" >&2
    exit 1
fi

# Homebrew records formulae installed explicitly, so dependencies are not offered.
installed_formulae="$(brew list --formula --installed-on-request --full-name)"
installed_casks="$(brew list --cask)"
declared_formulae="$(brew bundle list --formula --file "$brewfile")"
declared_casks="$(brew bundle list --cask --file "$brewfile")"

declare -A declared_formula=() declared_cask=()
while IFS= read -r name; do
    [[ -n "$name" ]] && declared_formula["$name"]=1
done <<< "$declared_formulae"
while IFS= read -r name; do
    [[ -n "$name" ]] && declared_cask["$name"]=1
done <<< "$declared_casks"

kinds=()
names=()
while IFS= read -r name; do
    if [[ -n "$name" && ! -v declared_formula["$name"] ]]; then
        kinds+=(formula)
        names+=("$name")
    fi
done <<< "$installed_formulae"
while IFS= read -r name; do
    if [[ -n "$name" && ! -v declared_cask["$name"] ]]; then
        kinds+=(cask)
        names+=("$name")
    fi
done <<< "$installed_casks"

if (( ${#names[@]} == 0 )); then
    printf 'All explicitly installed Homebrew formulae and casks are declared.\n'
    exit 0
fi

printf 'Installed Homebrew packages missing from %s:\n' "$brewfile"
for index in "${!names[@]}"; do
    printf '%3d. %-7s %s\n' "$((index + 1))" "${kinds[$index]}" "${names[$index]}"
done

if [[ ! -t 0 ]]; then
    printf 'Run interactively to select packages; Brewfile was not changed.\n' >&2
    exit 1
fi

printf 'Enter numbers separated by spaces, "all", or Enter to skip: '
IFS= read -r reply
if [[ -z "$reply" ]]; then
    printf 'No changes made.\n'
    exit 0
fi

declare -A selected=()
if [[ "$reply" == all ]]; then
    for index in "${!names[@]}"; do selected["$index"]=1; done
else
    read -r -a choices <<< "$reply"
    for choice in "${choices[@]}"; do
        if [[ ! "$choice" =~ ^[0-9]+$ ]] || (( 10#$choice < 1 || 10#$choice > ${#names[@]} )); then
            printf 'Invalid selection: %s. Brewfile was not changed.\n' "$choice" >&2
            exit 1
        fi
        selected["$((10#$choice - 1))"]=1
    done
fi

formulae=()
casks=()
for index in "${!names[@]}"; do
    [[ -v selected["$index"] ]] || continue
    if [[ "${kinds[$index]}" == formula ]]; then
        formulae+=("${names[$index]}")
    else
        casks+=("${names[$index]}")
    fi
done

if (( ${#formulae[@]} > 0 )); then
    brew bundle add --no-describe --file "$brewfile" --formula "${formulae[@]}"
fi
if (( ${#casks[@]} > 0 )); then
    brew bundle add --no-describe --file "$brewfile" --cask "${casks[@]}"
fi

printf 'Review the Brewfile diff before committing: git diff -- packages/Brewfile\n'
