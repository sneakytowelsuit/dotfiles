# Test a feature-branch workstation image

Push a branch to this repository, or dispatch **Build workstation OS** with that branch selected. Changes to `os/`, `bootstrap/`, `dotfiles/`, `mise.toml`, the build workflow, or `.containerignore` trigger builds. Publishing uses repository secrets, so fork pull requests do not publish images.

The default branch alone publishes `ghcr.io/sneakytowelsuit/workstation:stable`. Feature branches publish to the separate `ghcr.io/sneakytowelsuit/workstation-preview` package, using a tag such as `test-feat-mise-workstation-<branch-hash>` and an immutable `sha-<commit>` tag. Sanitized branch names include a hash to avoid collisions. Each successful build's Actions summary gives the exact image and commands. A failed build never advances its channel tag.

The image contains a pinned mise binary and a snapshot of `mise.toml`, `bootstrap/`, and `dotfiles/` under `/usr/share/workstation`. Homebrew/Flatpak packages and user runtimes are installed by sync after boot, not into the image at build time. Host packages remain in the Containerfile. Only explicitly selected public files enter the build context and image; signing keys are excluded.

## Before switching

Wait for both configuration validation and the image build/sign/publish jobs to pass. On the first publication, GitHub creates `workstation-preview` as a private package. To pull anonymously, open its [package settings](https://github.com/users/sneakytowelsuit/packages/container/workstation-preview/settings) and set visibility to **Public** once. Public visibility cannot be reversed. If all previews expire, cleanup deletes the entire preview package; a later publication recreates it privately, so repeat this setting then. Alternatively keep the package private and configure GHCR credentials for bootc and Cosign. The package must give this repository Actions access with the **Admin** role so cleanup can delete versions; packages initially published by this repository normally grant it automatically.

Record `sudo bootc status` and preserve any home changes. Image rollback does not roll back packages, dotfiles, or KDE preferences in your home directory. Keep a checkout of your known working user configuration. Confirm `rpm-ostree status -v` has no temporary layered RPMs before switching.

## Verify, switch, and apply

Copy the exact image from the build summary:

```bash
preview_image=ghcr.io/sneakytowelsuit/workstation-preview:TEST_TAG_FROM_BUILD_SUMMARY
cosign verify --key cosign.pub --new-bundle-format=false "$preview_image"
sudo bootc switch "$preview_image"
sudo systemctl reboot
```

After reboot:

```bash
sudo bootc status
ujust workstation-image-sync
mise -C /usr/share/workstation bootstrap status
getent passwd "$USER" | cut -d: -f7
```

`workstation-image-sync` applies the image snapshot, even if your registered checkout still points to another branch. It does not change that registration. Sync migrates symlinks from the old Stow layout only when they belong to the current source or the registered checkout; review other conflicts yourself. Run setup once from the old checkout first if that checkout was never registered. Open a new terminal, or sign out and back in after a login-shell change. Check Niri, Noctalia, Ghostty, the shell plugins, CLI tools, and [the hardware checklist](framework-validation.md).

For further edits, check out the feature branch in your writable repository and run `./bootstrap/setup.sh` there. Subsequent `ujust workstation-sync` uses that registered checkout. `WORKSTATION_REPO=/path/to/checkout ujust workstation-sync` selects another source explicitly.

## Seven-day expiry and returning to stable

**Clean up expired workstation preview images** runs hourly on the default branch and deletes every preview package version last updated more than seven days ago. This includes old branch tags, commit tags, untagged manifests, and Cosign signature artifacts. It gathers all pages before deleting and shares a concurrency lock with preview publication. When every version has expired, it deletes the preview package itself, avoiding GHCR’s restriction on deleting a last tagged version. The stable `workstation` package is never targeted. Rebuilding a branch publishes a new version with a fresh retention period. Expiry occurs at the next scheduled run, so allow seven days plus scheduling delay; GitHub can delay cron jobs.

GitHub runs scheduled workflows only from the default branch. The cleanup workflow must be installed there before relying on expiry for unmerged branches. For a manual check, dispatch it with **dry_run=true**; set **dry_run=false** to apply. Check its Actions log and summary for permission failures. GitHub may disable schedules in inactive public repositories; keep the schedule enabled while previews exist. Deleted versions may remain recoverable by the owner for GitHub's recovery window.

Return to stable before expiry so automatic updates do not keep polling a removed preview tag:

```bash
sudo bootc switch ghcr.io/sneakytowelsuit/workstation:stable
sudo systemctl reboot
```

Before returning to an older stable image, remove the deployed preview links with `mise -C /usr/share/workstation dotfiles unapply` while that snapshot is still available, then reapply your known working checkout's setup. Review the removal preview and confirmation. Reapply your working checkout's user setup after returning if needed. If stable predates this migration, its image has no `/usr/share/workstation` snapshot: restore user configuration from the checkout with its own `./bootstrap/setup.sh`. That also replaces links previously pointing into the preview image. A boot-menu rollback restores the OS deployment but likewise needs user configuration restored separately.
