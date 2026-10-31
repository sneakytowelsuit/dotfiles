# Framework 13 Pro workstation

This repository defines my Aurora DX Stable workstation. The custom OS image adds Niri, Noctalia, Zsh, and Ghostty to Aurora's Plasma desktop, with Foot available as a fallback. Bootstrap applies the user tools and home configuration. The goal is to be able to repeat these steps on a fresh install.

Already running stock Aurora DX on this Framework? Follow the machine-specific [migration guide](MIGRATION.md) to move this installation to the custom image.

| Location | What it owns |
| --- | --- |
| `os/` | Custom bootc image, host RPMs, and system files |
| `mise.toml` | User CLI packages, fonts, Flatpaks, dotfile deployment, and setup tasks |
| `dotfiles/` | A tree mirroring `$HOME`, linked file by file with mise |
| `dev/` | Runtime defaults and project environment guidance |
| `bootstrap/` | First setup and repeatable user sync |
| `.github/` | Image builds and configuration checks |

The commands below use this repository at `~/src/workstation` and publish `ghcr.io/sneakytowelsuit/workstation:stable`. If you fork the repository, change the image name in the switch command to match the owner used by the build workflow. Keep tokens, passwords, and `cosign.key` out of Git.

## 1. Install and check stock Aurora

Follow the [Aurora installation guide](https://docs.getaurora.dev/guides/install-guide/) and select **Stable** for the Framework's AMD/Intel graphics. Choose Aurora DX if the download picker offers it. If you installed regular Aurora Stable, run `ujust devmode` after the first login and reboot to switch to DX. Keep Plasma installed and use it during setup. Aurora documents [DX and its developer groups](https://docs.getaurora.dev/dx/aurora-dx-intro/).

Open a terminal in Plasma and run:

```bash
sudo bootc status
ujust update
sudo systemctl reboot
```

After reboot, check `sudo bootc status` again. The selected image should be `ghcr.io/ublue-os/aurora-dx:stable`. If you need Docker or devcontainers, run `ujust dx-group` and sign out and back in so group membership takes effect. Aurora Stable is the [weekly, gated-kernel stream](https://docs.getaurora.dev/guides/release-streams/).

Before changing the host, work through [the Framework hardware checklist](docs/framework-validation.md): Wi-Fi, Bluetooth, fingerprint, audio, brightness, charging, USB-C DisplayPort, suspend/resume, lid-close suspend, sleep drain, external display, ultrawide resolution, and 240 Hz. Record failures on stock Aurora so they are not confused with later image changes.

## 2. Clone and apply the user setup

In Plasma, clone this repository:

```bash
mkdir -p ~/src
git clone https://github.com/sneakytowelsuit/dotfiles.git ~/src/workstation
cd ~/src/workstation
```

Apply the repository:

```bash
./bootstrap/setup.sh
```

Bootstrap registers this checkout at `~/.local/share/workstation/repo`, ensures mise is available, configures the user Flathub remote, and runs `mise bootstrap`. The image includes a pinned mise binary; on an older host without mise, the helper downloads a pinned release and verifies its checksum. Update an existing older mise if the configuration reports a minimum-version error.

Interactive shells select the image's bundled mise even if an older Homebrew copy is still installed.

`mise.toml` declares Homebrew formulae, font casks, and user Flatpaks. Mise installs formulae directly into the standard Homebrew prefix; an existing Homebrew installation remains usable, but is not required. Creating that prefix may request sudo. Existing packages are not intentionally upgraded by sync. Runtime defaults and the three AI CLIs live in `dotfiles/.config/mise/config.toml`; those tools use mise's version management instead of Linux-incompatible application casks.

Home files live at their actual home-relative paths: `dotfiles/.gitconfig`, `dotfiles/.zshenv`, and `dotfiles/.config/<application>/...`. There are no Stow package wrappers or package lists. A one-time migration removes only symlinks pointing into this repository's old Stow layout (including a registered checkout); regular files and unrelated symlinks remain untouched. Existing unmanaged files that conflict with the new tree must be reviewed and backed up before retrying. Do not use force flags to bypass those conflicts.

Aurora omits `chsh`, so the bootstrap task retains the host-Zsh-only `sudo usermod` helper. The same task sets KDE's terminal defaults. The first interactive Zsh session downloads the Zinit plugins. Runtime installation and desktop settings run on every sync, with matching state left in place.

To preview, use `./bootstrap/sync.sh --dry-run`. This also previews old Stow links that need removal; mise may report those links as conflicts until the real migration runs. For an existing regular `~/.gitconfig`, preserve its settings before linking: `mkdir -p ~/.config/git && mv ~/.gitconfig ~/.config/git/local.gitconfig`. Review any existing Niri configuration against `dotfiles/.config/niri/config.kdl` and preserve it before moving a conflicting target aside.

At this point, stay in Plasma. The host packages and `ujust workstation-sync` arrive with the custom image in step 4. If stock Aurora does not provide Zsh, bootstrap will set the login shell when you rerun it after the image switch.

## 3. Publish the custom image

If this repository already has `cosign.pub` and a successful, publicly accessible `workstation:stable` image on GHCR, **skip key generation and go to step 4**. A new laptop uses the existing published image. Do not rotate the signing key merely because you reinstalled Aurora. If the package exists but is private, make it public as described below or configure registry credentials on the laptop before switching.

For the **first publication**, the workflow needs a Cosign signing key. Cosign is declared in `mise.toml`, so it should be available after step 2. From the repository root:

```bash
COSIGN_PASSWORD="" cosign generate-key-pair
git check-ignore cosign.key
```

The second command should print `cosign.key`. Store the private key securely outside this Git checkout after registering it; commit only `cosign.pub`. The [Universal Blue image template](https://github.com/ublue-os/image-template) uses the same `SIGNING_SECRET` setup.

Cosign signs each published image digest with `cosign.key`; `cosign.pub` checks that signature. GitHub Actions uses the private key from `SIGNING_SECRET`, so your laptop does not need the private key to install or verify the image. Keep a copy of `cosign.key` in a password manager or other secure backup that survives an OS reinstall. The local `cosign.key` is ignored by Git and is **not** included when you clone this repository on another machine. If the GitHub secret is lost, restore it from that backup with `gh secret set SIGNING_SECRET --repo sneakytowelsuit/dotfiles < /path/to/cosign.key`. Do not generate a new key for each install; doing so would make old images fail verification with the new public key.

Bitwarden is a good place for that backup. After signing in to the Bitwarden CLI, unlock your personal vault in your own terminal, then create a secure note from the existing key without printing it or putting it in shell history:

```bash
export BW_SESSION="$(bw unlock --raw)"
set -o pipefail
bw get template item \
  | jq --rawfile signing_key cosign.key '.type = 2 | .secureNote.type = 0 | .name = "Workstation OS Cosign private key" | .notes = $signing_key' \
  | bw encode \
  | bw create item \
  | jq -r '.id'
bw get item 'Workstation OS Cosign private key' | jq -j '.notes' | cmp -s cosign.key - && echo 'Bitwarden backup matches local key'
bw lock
unset BW_SESSION
```

Run this **once**; creating it again makes a duplicate vault item. Keep the key in your personal vault rather than a shared collection. Once you have checked the backup, you may remove the ignored local `cosign.key`. On a fresh machine, unlock Bitwarden and restore it only if you need to recreate the GitHub secret: `umask 077; bw get item 'Workstation OS Cosign private key' | jq -j '.notes' > cosign.key`. Then set `SIGNING_SECRET` from that file and remove the temporary copy after checking it. The normal fresh-install path only needs the committed public key. See [Bitwarden's CLI guide](https://bitwarden.com/help/cli/) for login, unlock, secure notes, and vault locking.

In GitHub, open this repository → **Settings → Secrets and variables → Actions → New repository secret**. Name the secret `SIGNING_SECRET` and paste the contents of `cosign.key`. If you prefer the CLI, sign in with `gh auth login` and run `gh secret set SIGNING_SECRET --repo sneakytowelsuit/dotfiles < cosign.key`. Keep a secure backup of the private key in case the Actions secret must be recreated.

Review `git status`, commit the intended repository files and `cosign.pub`, then push to the default branch. On a fresh clone where only the public key is new, use `git add cosign.pub`, `git commit -m "Add image signing public key"`, and `git push`. If Git asks for your identity, set `user.name` and `user.email` in `dotfiles/.gitconfig` first. Enable Actions in GitHub if prompted. A push that changes image files, dotfiles, bootstrap, or `mise.toml` starts the build. The default branch publishes stable; feature branches publish previews. Otherwise open **Actions → Build workstation OS → Run workflow**. Wait for the **build** job to pass. If it fails, inspect its log and fix the repository before switching the laptop.

The workflow builds from the current `ghcr.io/ublue-os/aurora-dx:stable` digest, checks that the custom `ujust` recipe is present, signs the result, and then advances the `stable` tag. It also checks the base digest daily at 08:17 UTC and skips a scheduled build when the base is unchanged. Dotfile and package changes also rebuild the image because it contains a configuration snapshot at `/usr/share/workstation`. They can still be applied from a checkout without rebooting.

After the first successful build, find the `workstation` package under the `sneakytowelsuit` GitHub profile. To let the laptop pull updates without registry credentials, open **Package settings → Change visibility → Public**. [GitHub notes](https://docs.github.com/en/packages/learn-github-packages/configuring-a-packages-access-control-and-visibility) that this change cannot be reversed. Verify the published signature from the repository root:

```bash
cosign verify --key cosign.pub --new-bundle-format=false ghcr.io/sneakytowelsuit/workstation:stable
```

The image is signed, but this repository does not yet configure the laptop to *require* that signature during future pulls.

## 4. Switch the Framework and finish setup

Once the image has built and is available from GHCR, remove any temporary host package layers **before** switching. `bootc` cannot switch or upgrade a deployment with local RPM layers. List the requested packages first:

```bash
rpm-ostree status -v
rpm-ostree status --json | jq -r '.deployments[] | select(.booted == true) | ."requested-packages"[]?'
```

If this shows the prototype `niri`, `niri-settings`, and `noctalia` layers, remove them and reboot into Plasma. On a clean fresh install with no layers, skip this step:

```bash
sudo rpm-ostree uninstall niri niri-settings noctalia
sudo systemctl reboot
```

After reboot, confirm `rpm-ostree status -v` has no layered packages. Verify the published image from the repository root:

```bash
cd ~/src/workstation
cosign verify --key cosign.pub --new-bundle-format=false ghcr.io/sneakytowelsuit/workstation:stable
```

Then switch:

```bash
sudo bootc switch ghcr.io/sneakytowelsuit/workstation:stable
sudo systemctl reboot
```

This [bootc switch method](https://github.com/ublue-os/image-template) keeps the previous deployment available. After reboot, confirm the booted image:

```bash
sudo bootc status
rpm-ostree status -v
cd ~/src/workstation
./bootstrap/setup.sh
ujust workstation-sync
```

The second bootstrap run sets Zsh as the login shell if it was unavailable on stock Aurora. On Aurora it uses `sudo usermod` because `chsh` is not installed. Sign out and back in, then check `getent passwd "$USER" | cut -d: -f7`; it should end in `zsh`. At SDDM, select **Niri** and verify Noctalia, the launcher (`Mod+Space`), Ghostty (`Mod+T`), Firefox (`Mod+B`), volume, brightness, lock (`Mod+L`), and the session menu (`Mod+Shift+E`). Confirm Plasma remains selectable. Repeat [the hardware checklist](docs/framework-validation.md) on the custom image.

On the custom image, `ujust workstation-sync` reads the registered checkout and applies the mise declarations. On stock Aurora, before that recipe exists, run the equivalent from this repository:

```bash
WORKSTATION_REPO="$PWD" just --justfile os/build_files/60-custom.just workstation-sync
```

## 5. Daily use

Make changes in this checkout, apply them, test, then commit and push:

| Change | Edit | Apply |
| --- | --- | --- |
| GUI app | Add `"flatpak-user:APP_ID" = "latest"` to `mise.toml` | `ujust workstation-sync` |
| User CLI or font | Add a `brew:` or `brew-cask:` entry to `mise.toml` | `ujust workstation-sync` |
| Home config | Edit or add its home-relative path under `dotfiles/` | `ujust workstation-sync` |
| Runtime or versioned CLI default | Edit `dotfiles/.config/mise/config.toml` | `ujust workstation-sync` |
| Host RPM or system file | Edit `os/` after testing | Push; wait for a successful image build |
| Project environment | Use a project mise file, devcontainer, or Distrobox | Apply in that project |

`ujust workstation-sync` applies the registered checkout; with no registered checkout, it uses the image snapshot. `ujust workstation-image-sync` explicitly applies the booted image's snapshot without changing the registered checkout. Both use the same mise configuration. Bootstrap owns only declared files; edits elsewhere remain local.

From this checkout, inspect and apply declarations directly:

```bash
mise trust
mise bootstrap --dry-run
mise bootstrap status
# Run the wrapper for migration and Flathub setup, then mise bootstrap:
./bootstrap/sync.sh
```

To capture a manually installed formula, preview `mise bootstrap packages import --path mise.toml --dry-run`, then run it without `--dry-run` and review `git diff -- mise.toml`. It imports explicitly installed formulae, not dependencies, and does not import casks or offer numbered selection. `ujust workstation-capture-brew` remains a preview-only compatibility wrapper. When using the immutable image snapshot, make changes in a writable checkout instead.

Sync installs missing packages without intentionally upgrading them or removing undeclared packages. Use `mise bootstrap packages upgrade` for declared Brew/Flatpak packages and `mise upgrade --global` for mise-managed tools; use `ujust update` for Aurora's normal system/app update path. Aurora normally runs [automatic updates](https://docs.getaurora.dev/guides/basic-usage/). Check `rpm-ostree status -v` for staging. A staged image becomes active after reboot.

For a feature-branch build, follow [the preview image guide](docs/preview-images.md). Preview images expire after seven days; return to stable when testing finishes.

For an uncertain host package, prototype with `sudo rpm-ostree install PACKAGE_NAME`, reboot and test it, then either uninstall it or add it to `os/Containerfile`. Once the new image works, remove the temporary local layer. Keep steady-state local layering near zero.

Ghostty is the default terminal. The image installs it from the `scottames/ghostty` COPR documented in [Ghostty's Fedora installation guide](https://ghostty.org/docs/install/binary#fedora). Its configuration lives at `dotfiles/.config/ghostty/config`. Niri opens it with `Mod+T` and exports `TERMINAL=ghostty` for Noctalia's terminal applications. Bootstrap and `ujust workstation-sync` set KDE's terminal application and desktop service in `kdeglobals`, preserving its other settings. Foot remains installed; `Mod+T` opens Foot when Ghostty is unavailable, and sync leaves KDE's current terminal default alone until Ghostty is installed.

To adopt Ghostty on an existing workstation, commit and push the image changes and wait for **Build workstation OS** to succeed. Then run `sudo bootc upgrade`, reboot into the updated image, and run `ujust workstation-sync`. Sign out and back in if Niri or Noctalia was already running when you applied the configuration, so Noctalia inherits the terminal environment. Check `ghostty +validate-config`, `Mod+T`, a terminal application launched through Noctalia, and Dolphin's **Open Terminal** action. Sync alone cannot install the host RPM.

Zsh is for interactive sessions; scripts remain Bash. `dotfiles/.zshenv` sets `ZDOTDIR=~/.config/zsh`, and the interactive configuration now lives directly at `dotfiles/.config/zsh/.zshrc`. There is no forwarding `~/.zshrc`. The login profile adds mise shims for editors; the interactive file activates mise and initializes Starship, Zoxide, and Atuin. Keep these activation lines in the tracked files: mise's generic shell shortcut ignores `ZDOTDIR`.

Zinit handles completions, fzf-tab, autosuggestions, and syntax highlighting, with native vi mode. Each project owns its devcontainers and Distroboxes.

In Niri, the Framework F12 logo action opens Noctalia's application launcher, and the F9 display action (Super+P) opens its Niri Displays panel. Depending on Fn lock, hold Fn to access these actions. The Noctalia config enables `raycursive/niri-displays` from the built-in community source. Bootstrap and `ujust workstation-sync` apply these declarations without an OS rebuild. Noctalia downloads the plugin; if the panel is unavailable after first enabling it, restart Noctalia or sign out and back in (required in testing with Noctalia 5.1.0). The panel changes display settings temporarily; keep permanent resolution, refresh rate, scale, and placement defaults in `dotfiles/.config/niri/config.kdl`.

## Recovery

- Niri or Noctalia fails: sign out and choose **Plasma** in SDDM. Check `niri validate --config ~/.config/niri/config.kdl` and Noctalia's log at `~/.cache/noctalia/noctalia.log`.
- New image fails to boot or breaks hardware: choose the previous deployment in the boot menu. From a working boot, `sudo bootc rollback` stages the previous deployment.
- Bad permanent host change: revert the Git change in `os/`, push, wait for a successful rebuild, and reboot after the new image stages.
- A sync stops on dotfile conflicts: preserve or merge the existing home file, move the conflicting target aside, and rerun `ujust workstation-sync`. The script does not overwrite it automatically.
- Image build fails: the published `:stable` tag stays on the last successful build. Read the GitHub Actions log; the laptop continues using its last available image.

Keep a previous deployment until Niri, Plasma, and the Framework hardware checks pass on the new one.
