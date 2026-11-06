# NixOS on the Framework 13 Pro

This directory defines a NixOS replacement for the Aurora workstation in `../aurora/`: Niri, Noctalia, Zsh, and Ghostty, with Plasma as the fallback session and Foot as the fallback terminal. It shares no files with `aurora/`.

| Location | What it owns |
| --- | --- |
| `flake.nix`, `flake.lock` | Pinned inputs and the `framework` system |
| `hosts/framework/` | System configuration and hardware |
| `home/default.nix` | User packages and links into the home directory |
| `home/dotfiles/` | This OS's own copy of the home configuration |

## 1. Before wiping Aurora

Installing erases Aurora and everything in your home directory. Copy these somewhere off the laptop, because Git does not hold them:

- `~/.ssh/id_ed25519` and `~/.ssh/config.local`
- `~/.config/git/local.gitconfig`
- `cosign.key` from the checkout. Publishing Aurora images uses the `SIGNING_SECRET` GitHub secret, but you need this key to re-register that secret or rotate it. `aurora/README.md` describes a Bitwarden backup.
- Your documents, any uncommitted or unpushed work, and any other data you care about

Push this repository and confirm the `workstation:stable` image still builds. Rolling back depends on both.

## 2. Install

Follow [Framework's NixOS guide](https://guides.frame.work/Guide/NixOS+on+the+Framework+Laptop+13+Pro/780):

1. In the BIOS (F2), go to **Administer Secure Boot → Enforce Secure Boot** and disable it. NixOS will not boot with it enabled.
2. Boot the installer USB (F12) and connect to Wi-Fi.
3. Choose the non-LTS kernel. Create the user `austinstowe`, which is the name this configuration expects.

After rebooting into the new system:

```bash
nix-shell -p git
git clone https://github.com/sneakytowelsuit/dotfiles.git ~/Development/dotfiles
cd ~/Development/dotfiles
cp /etc/nixos/hardware-configuration.nix nixos/hosts/framework/hardware-configuration.nix
git add nixos/hosts/framework/hardware-configuration.nix
grep -n 'luks\|stateVersion' /etc/nixos/configuration.nix
```

The last command shows two things to copy into `nixos/hosts/framework/configuration.nix`:

- Any `boot.initrd.luks` lines. If you enabled disk encryption, the installer can put these in `configuration.nix` instead of the hardware file, and the system will not unlock without them.
- The `system.stateVersion` value. If it differs from this repository's, change it there and `home.stateVersion` in `home/default.nix`.

Then apply the configuration:

```bash
sudo NIX_CONFIG='experimental-features = nix-command flakes' nixos-rebuild boot --flake ./nixos#framework
sudo systemctl reboot
```

Home Manager links files from `~/Development/dotfiles/nixos/home/dotfiles`, so keep the checkout at that path or change `dotfiles` in `home/default.nix`.

A flake only sees files Git tracks. Run `git add` on new files before rebuilding, or Nix reports that they do not exist. Do not put secrets in tracked files: tracked files in this repository are copied into the world-readable Nix store.

## 3. Finish setup

Select **Niri** in SDDM, then restore your backed-up files and run the steps Nix does not manage:

```bash
chmod 600 ~/.ssh/id_ed25519
ssh-add ~/.ssh/id_ed25519
mise install
flatpak remote-add --user --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo
flatpak install --user flathub com.google.Chrome com.discordapp.Discord io.github.DenysMb.Kontainer us.zoom.Zoom
curl -fsSL https://releases.herdr.dev/app/install.sh -o /tmp/herdr-app-install.sh
less /tmp/herdr-app-install.sh
sh /tmp/herdr-app-install.sh
```

Then check the items in `../aurora/docs/framework-validation.md`. The first login may take a while as Zinit downloads its plugins.

Niri's `Mod+B` runs the Chrome Flatpak, so it does nothing until that install finishes.

## Daily use

```bash
cd ~/Development/dotfiles
sudo nixos-rebuild switch --flake ./nixos#framework     # apply changes
nix flake update --flake ./nixos                        # update inputs, then rebuild
```

Dotfile edits apply straight away because the home links point into the checkout. Package and system changes need a rebuild. If a generation misbehaves, choose an earlier one in the boot menu or run `sudo nixos-rebuild switch --rollback`.

## Differences from Aurora

These Aurora packages have no equivalent here yet:

| Package | Status |
| --- | --- |
| `herdr-app` | Not in nixpkgs. Uses the upstream installer above and is not declared by the flake. Whether its prebuilt binary runs under `nix-ld` is untested. |
| `llmman`, `linux-mcp-server` | Not in nixpkgs. Package them or install them another way. |
| `niri-settings` | Not in nixpkgs. |
| `bbrew` | Left out on purpose: it is a Homebrew interface, and this system has no Homebrew. |
| `opencode` | Left out on purpose: not needed on this install. |

Aurora DX also provides things this configuration does not, such as Incus and its `ujust` recipes. Add those as you find you need them.

## Rolling back to Aurora

Rollback is a reinstall, not a boot-menu choice, because NixOS replaces Aurora on disk. The `aurora/` directory and its image builds keep working in the meantime.

1. Back up your NixOS home directory as in step 1.
2. Install Aurora and follow [aurora/README.md](../aurora/README.md).

Do not reuse a home directory from NixOS on Aurora. Its Home Manager links point into the Nix store and `nixos/home/dotfiles`, and they will conflict with the links Aurora's mise creates.
