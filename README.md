# Framework 13 Pro workstation

This repository defines my Aurora DX Stable workstation. The custom OS image adds Niri, Noctalia, Zsh, and Foot to Aurora's Plasma desktop. Bootstrap applies the user tools and home configuration. The goal is to be able to repeat these steps on a fresh install.

| Location | What it owns |
| --- | --- |
| `os/` | Custom bootc image, host RPMs, and system files |
| `dotfiles/` | Home files linked with GNU Stow |
| `packages/Brewfile` | User CLI tools |
| `packages/flatpaks.txt` | GUI apps to install from Flathub |
| `packages/stow.txt` | Stow packages to keep linked |
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

Check Homebrew with `command -v brew`. If it is installed but missing from Bash's path, run:

```bash
eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"
```

If the binary does not exist, use the [official Homebrew installer](https://docs.brew.sh/Installation), read its prompts, then run the `brew shellenv` command above:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"
```

The installer may ask for your password. This repository does not automate that system-level installer.

Apply the repository:

```bash
./bootstrap/setup.sh
```

Bootstrap registers this checkout at `~/.local/share/workstation/repo`, installs missing Brew formulae and Flatpaks, links the packages in `packages/stow.txt`, installs the declared mise runtimes, and changes the login shell to Zsh if the host already has Zsh. It is safe to rerun. The Brew step avoids intentional upgrades of existing formulae. The first Zsh session downloads the declared Zinit plugins.

If Stow reports a conflict, it has left the existing home file in place. Compare that file with its counterpart under `dotfiles/`. Save anything you want to keep in the repository or a backup, move the conflicting home file aside, and rerun `./bootstrap/setup.sh`. Do not use `stow --adopt` without reviewing what it would copy into Git. On an existing home, common conflicts are `~/.gitconfig` and `~/.config/niri/config.kdl`; a fresh install may have none.

On a machine with an existing `~/.gitconfig`, preserve its local identity settings before Stow links the repository version: `mkdir -p ~/.config/git && mv ~/.gitconfig ~/.config/git/local.gitconfig`. The tracked Git config includes that local file; it stays outside Git. For an existing Niri config, compare it with `dotfiles/niri/.config/niri/config.kdl`. Copy any settings you want to keep into the tracked file, then move the old home file aside before rerunning bootstrap. The tracked Niri config is intentionally minimal, so do not discard a working configuration without reviewing it.

At this point, stay in Plasma. The host packages and `ujust workstation-sync` arrive with the custom image in step 4. If stock Aurora does not provide Zsh, bootstrap will set the login shell when you rerun it after the image switch.

## 3. Publish the custom image

If this repository already has `cosign.pub` and a successful, publicly accessible `workstation:stable` image on GHCR, **skip key generation and go to step 4**. A new laptop uses the existing published image. Do not rotate the signing key merely because you reinstalled Aurora. If the package exists but is private, make it public as described below or configure registry credentials on the laptop before switching.

For the **first publication**, the workflow needs a Cosign signing key. Cosign is declared in the Brewfile, so it should be available after step 2. From the repository root:

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

Review `git status`, commit the intended repository files and `cosign.pub`, then push to the default branch. On a fresh clone where only the public key is new, use `git add cosign.pub`, `git commit -m "Add image signing public key"`, and `git push`. If Git asks for your identity, set `user.name` and `user.email` in the Stow-managed `dotfiles/git/.gitconfig` first. Enable Actions in GitHub if prompted. A push that changes `os/` or `.github/workflows/build-os.yml` starts the build. Otherwise open **Actions → Build workstation OS → Run workflow**. Wait for the **build** job to pass. If it fails, inspect its log and fix the repository before switching the laptop.

The workflow builds from the current `ghcr.io/ublue-os/aurora-dx:stable` digest, checks that the custom `ujust` recipe is present, signs the result, and then advances the `stable` tag. It also checks the base digest daily at 08:17 UTC and skips a scheduled build when the base is unchanged. A dotfile or Brewfile change does not rebuild the OS.

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

The second bootstrap run sets Zsh as the login shell if it was unavailable on stock Aurora. Sign out and back in, then check `getent passwd "$USER" | cut -d: -f7`; it should end in `zsh`. At SDDM, select **Niri** and verify Noctalia, the launcher (`Mod+Space`), Foot (`Mod+Return`), Firefox (`Mod+B`), volume, brightness, lock (`Mod+L`), and the session menu (`Mod+Shift+E`). Confirm Plasma remains selectable. Repeat [the hardware checklist](docs/framework-validation.md) on the custom image.

On the custom image, `ujust workstation-sync` reads the registered checkout and applies new Brew, Flatpak, and Stow declarations. On stock Aurora, before that recipe exists, run the equivalent from this repository:

```bash
WORKSTATION_REPO="$PWD" just --justfile os/build_files/60-custom.just workstation-sync
```

## 5. Daily use

Make changes in this checkout, apply them, test, then commit and push:

| Change | Edit | Apply |
| --- | --- | --- |
| GUI app | Add its Flathub ID to `packages/flatpaks.txt` | `ujust workstation-sync` |
| User CLI | Add a formula to `packages/Brewfile` | `ujust workstation-sync` |
| Home config | Edit a Stow-linked file or add a file to a listed package | `ujust workstation-sync` |
| New Stow package | Add its directory under `dotfiles/` and name to `packages/stow.txt` | `ujust workstation-sync` |
| Runtime default | Edit `dotfiles/mise/.config/mise/config.toml` | `mise install` |
| Host RPM or system file | Edit `os/` after testing | Push; wait for a successful image build |
| Project environment | Use a project mise file, devcontainer, or Distrobox | Apply in that project |

If you installed a Homebrew package by hand while testing, run `ujust workstation-capture-brew`. It compares formulae explicitly installed on request and installed casks with `packages/Brewfile`, then shows numbered missing entries. Enter the numbers you want to keep (or `all`); Enter alone leaves the file unchanged. Review `git diff -- packages/Brewfile` before committing. Dependencies installed automatically by Homebrew are not offered. On stock Aurora, or before the new image with this recipe reaches the laptop, run `./bootstrap/capture-brew.sh` from this checkout instead. This command only adds selected entries to the Brewfile; `ujust workstation-sync` applies declarations in the other direction.

`ujust workstation-sync` installs declared items that are missing and restows links; it does not remove packages omitted from a list. Use `ujust update` when you want Aurora to update the system and existing apps. Aurora normally runs [automatic updates](https://docs.getaurora.dev/guides/basic-usage/); the laptop should follow the selected custom `:stable` image after switching. Check `rpm-ostree status -v` for automatic staging, or use `ujust toggle-updates` if updates were disabled. A staged image becomes active after the next reboot.

For an uncertain host package, prototype with `sudo rpm-ostree install PACKAGE_NAME`, reboot and test it, then either uninstall it or add it to `os/Containerfile`. Once the new image works, remove the temporary local layer. Keep steady-state local layering near zero.

Zsh is for interactive sessions; scripts remain Bash. The Stow-managed Zsh configuration uses Zinit for completions, fzf-tab, autosuggestions, and syntax highlighting, with native vi mode. The repository does not create project devcontainers or Distroboxes automatically; each project owns those environments.

## Recovery

- Niri or Noctalia fails: sign out and choose **Plasma** in SDDM. Check `niri validate --config ~/.config/niri/config.kdl` and Noctalia's log at `~/.cache/noctalia/noctalia.log`.
- New image fails to boot or breaks hardware: choose the previous deployment in the boot menu. From a working boot, `sudo bootc rollback` stages the previous deployment.
- Bad permanent host change: revert the Git change in `os/`, push, wait for a successful rebuild, and reboot after the new image stages.
- A sync stops on Stow conflicts: preserve or merge the existing home file, move the conflicting target aside, and rerun `ujust workstation-sync`. The script does not overwrite it automatically.
- Image build fails: the published `:stable` tag stays on the last successful build. Read the GitHub Actions log; the laptop continues using its last available image.

Keep a previous deployment until Niri, Plasma, and the Framework hardware checks pass on the new one.
