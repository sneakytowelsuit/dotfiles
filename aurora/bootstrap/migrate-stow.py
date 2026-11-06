#!/usr/bin/env python3
"""Remove only this repository's legacy Stow links before mise deploys files."""

import argparse
import os
from pathlib import Path


PACKAGES = {"git", "mise", "niri", "noctalia", "nvim", "shell", "terminal", "zsh"}


def legacy_links(home, roots):
    prefixes = [root / "dotfiles" / package for root in roots for package in PACKAGES]

    def visit(path):
        if path.is_symlink():
            # Do not resolve: old links can be broken after switching branches.
            target = Path(os.path.abspath(path.parent / os.readlink(path)))
            relative = path.relative_to(home)
            if any(target == prefix / relative for prefix in prefixes):
                yield path
            return
        if path.is_dir():
            # Avoid walking unrelated application data under ~/.config.
            children = ([path / name for name in ("foot", "ghostty", "mise", "niri", "noctalia", "nvim", "zsh")]
                        if path == home / ".config" else sorted(path.iterdir()))
            for child in children:
                yield from visit(child)

    for name in (".gitconfig", ".zshenv", ".zshrc", ".config"):
        yield from visit(home / name)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    home = Path.home()
    roots = {args.root.resolve()}
    registered = home / ".local/share/workstation/repo"
    if registered.is_symlink():
        roots.add(registered.resolve())
    for link in legacy_links(home, roots):
        print(f"{'Would remove' if args.dry_run else 'Removing'} legacy Stow link: {link}")
        if not args.dry_run:
            link.unlink()


if __name__ == "__main__":
    main()
