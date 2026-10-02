# Migrate this Framework to the workstation image

This is the one-time path for the Framework currently using this checkout at `/var/home/austinstowe/Development/dotfiles`. For a fresh installation, start with [README.md](README.md). Run the commands below in a terminal in **Plasma**. Keep Plasma available until Niri and the hardware checks pass.

At the time this guide was written, the laptop booted stock `ghcr.io/ublue-os/aurora-dx:stable` with local `niri`, `niri-settings`, and `noctalia` RPM layers. The custom `ghcr.io/sneakytowelsuit/workstation:stable` image had built successfully and its Cosign signature had been verified. The login shell was Bash, bootstrap had not registered this checkout, and Stow would conflict with the existing `~/.gitconfig` and `~/.config/niri/config.kdl`. Check the current state before following a step if you have since changed the machine.

## 1. Preserve the existing home configuration

The repo's Niri config is intentionally minimal; the current home config is much larger. Compare them and copy any settings you want to keep into the tracked file before moving the home file. The existing Git config contains your commit identity, which the tracked config will load from a local include file.

```bash
cd /var/home/austinstowe/Development/dotfiles
diff -u dotfiles/niri/.config/niri/config.kdl ~/.config/niri/config.kdl | less
```

If you want to keep the entire current Niri config, copy it into `dotfiles/niri/.config/niri/config.kdl` and review `git diff` before continuing. Otherwise, the tracked minimal config will become active. Preserve the existing files and clear the Stow targets:

```bash
mkdir -p ~/.config/git
mv -i ~/.gitconfig ~/.config/git/local.gitconfig
mv -i ~/.config/niri/config.kdl ~/.config/niri/config.kdl.pre-stow
```

The tracked `.gitconfig` includes `~/.config/git/local.gitconfig`, so your Git name and email remain available without being committed to this repo.

## 2. Apply the user environment

```bash
./bootstrap/setup.sh
readlink -f ~/.gitconfig
git config --global user.name
getent passwd "$USER" | cut -d: -f7
```

Bootstrap registers this checkout for the future `ujust` recipes, installs missing Brew formulae and Flatpaks, links the listed Stow packages, installs mise tools, and changes the login shell to Zsh. Aurora does not include `chsh`, so bootstrap uses `sudo usermod` there and may ask for your password. Sign out and back in before judging the interactive shell. If Stow reports another conflict, review and preserve that file, then rerun `./bootstrap/setup.sh`; it is designed to be repeatable. The `ujust workstation-sync` recipe will appear only after the custom image is booted.

## 3. Remove the temporary RPM layers

The three prototype packages are already in the custom image. Remove their local layers **before** using `bootc switch`:

```bash
rpm-ostree status -v
sudo rpm-ostree uninstall niri niri-settings noctalia
sudo systemctl reboot
```

Log into Plasma after the reboot. Niri may be absent during this brief stock-image stage. Confirm the booted deployment has no `LayeredPackages` before proceeding:

```bash
rpm-ostree status -v
```

If the packages are already absent, skip the uninstall and its reboot. See [bootc's relationship with rpm-ostree](https://bootc.dev/bootc/relationships.html) for why local layers prevent `bootc` from managing the deployment.

## 4. Verify and switch to the published image

```bash
cd /var/home/austinstowe/Development/dotfiles
cosign verify --key cosign.pub --new-bundle-format=false ghcr.io/sneakytowelsuit/workstation:stable
sudo bootc switch ghcr.io/sneakytowelsuit/workstation:stable
sudo systemctl reboot
```

The signature check verifies the image against the public key in Git. The switch stages a new deployment for the next boot and retains the previous deployment. This repo signs images but does not yet configure the laptop to require that signature on every future pull. The [Universal Blue image template](https://github.com/ublue-os/image-template) documents the switch method.

## 5. Check the custom deployment

Log into Plasma first and run:

```bash
cd /var/home/austinstowe/Development/dotfiles
sudo bootc status
rpm-ostree status -v
./bootstrap/setup.sh
ujust --list | rg workstation
getent passwd "$USER" | cut -d: -f7
systemctl list-timers uupd.timer
```

The booted image should be `ghcr.io/sneakytowelsuit/workstation:stable`, with no local RPM layers. `ujust` should list `workstation-sync` and `workstation-capture-brew`, and the login shell should end in `zsh`. The second bootstrap run reconciles user packages and links after the image switch. Use `ujust workstation-sync` for later Brewfile, Flatpak, and Stow changes. Aurora's `uupd.timer` was active before migration; check that it remains scheduled so future successful custom images are staged automatically.

If the custom deployment is already booted, do not switch it again just to pick up bootstrap fixes. Pull this repository, rerun `./bootstrap/setup.sh`, and perform the checks above; bootstrap operates on the user environment and is intentionally repeatable.

Then sign out, select **Niri** in SDDM, and check Noctalia, the launcher, Foot, Firefox, audio, brightness, lock, and logout. Confirm **Plasma** is still selectable. Repeat the [Framework hardware checklist](docs/framework-validation.md), particularly external display, 240 Hz, and suspend/resume.

If Niri is unusable, log back into Plasma and fix the Stow-managed config. If the custom image itself fails, boot the previous deployment. The ignored `cosign.key` is not needed to use the image; keep it until you have verified its Bitwarden backup as described in [README.md](README.md). The pre-existing untracked `dotfiles/bash/` is outside `packages/stow.txt` and is not applied by bootstrap.
