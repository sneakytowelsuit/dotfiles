# NixOS

Flake-based NixOS configurations, with Home Manager as a NixOS module. Everything (system, shell, editor, git) is declared here; nothing is symlinked from elsewhere.

## Apply

```sh
sudo nixos-rebuild switch
```

`/etc/nixos` is a symlink to this directory, and `nixos-rebuild` uses `/etc/nixos/flake.nix` by default, picking the configuration named after the hostname. On a new machine, create the link once:

```sh
sudo ln -s ~/Development/dotfiles/nixos /etc/nixos   # move any existing /etc/nixos aside first
```

The explicit form still works anywhere: `sudo nixos-rebuild switch --flake ~/Development/dotfiles/nixos#framework`.

## Update packages

```sh
nix flake update --flake ~/Development/dotfiles/nixos   # bumps flake.lock
sudo nixos-rebuild switch
```

Commit `flake.lock` afterwards; it records the exact versions the system was built from. Run `nix fmt` to format all `.nix` files.

## Layout

```
flake.nix                 inputs, and one `mkHost` line per machine
hosts/<name>/             machine-specific: hardware, boot, stateVersion,
                          and which modules the machine uses
modules/nixos/            reusable system modules
  base.nix                  every machine: nix settings, locale, networking
  desktop.nix               GNOME, sound, printing
  yubikey.nix               YubiKey for sudo/polkit/login
  kdeconnect.nix            KDE Connect firewall ports (the per-user side is modules/home/kdeconnect.nix)
  users/austin.nix          the account, zsh login shell, Home Manager wiring
modules/home/             austin's Home Manager config, shared by all hosts
  shell.nix                 zsh, plugins, starship, atuin, zoxide, fzf, direnv
  emacs.nix + doom/         Doom Emacs (doom/*.el is the Doom config)
  git.nix                   git, gh, lazygit
  vscode.nix, agents.nix
  herdr-layout.nix          links ../../herdr-dungeon-crawler into ~/.config/herdr-app
  kdeconnect.nix            KDE Connect daemon and tray icon
  tools.nix                 everyday CLI tools: jq, yq, python3, fd, tree, file, imagemagick, ...
  cursor.nix                Bibata Modern Classic cursor, 32px, for GNOME and Hyprland
```

New files must be `git add`ed before rebuilding: flakes only see files git tracks.

## Adding a machine

1. On the new machine: `nixos-generate-config --show-hardware-config > hosts/<name>/hardware-configuration.nix`
2. Create `hosts/<name>/default.nix` importing the modules it needs (copy `hosts/framework/default.nix` and trim). Set `system.stateVersion` and `home-manager.users.austin.home.stateVersion` to the release it was installed with.
3. Add `<name> = mkHost "<name>";` to `nixosConfigurations` in `flake.nix`.
4. First build: `sudo nixos-rebuild switch --flake .#<name>` (this also sets the hostname).
5. Link `/etc/nixos` to the checkout as described under Apply; after that, plain `sudo nixos-rebuild switch` works.

## Doom Emacs

Doom and its packages are built by Nix ([nix-doom-emacs-unstraightened](https://github.com/marienz/nix-doom-emacs-unstraightened)), so there is no `doom sync`: edit `modules/home/doom/*.el` and rebuild. Emacs runs as a background service; `$EDITOR` is `emacsclient -t`. After a rebuild, restart it to load the new config: `systemctl --user restart emacs`.

## EasyEffects (Framework 13 Pro)

The Framework host enables EasyEffects through Home Manager. It starts with either GNOME or Hyprland and loads `FW13PRO` into the output pipeline; it does not select an input/microphone preset. PipeWire is already enabled by `modules/nixos/desktop.nix`.

`hosts/framework/FW13PRO.json` is an unmodified copy of [hegocre's Framework 13 Pro preset](https://gist.github.com/hegocre/fea11a58e47a445d0b470f377cfaa655/a94384289dee679bc5794850cbf54f9af28ec179). Keeping the JSON in this repo makes rebuilds reproducible without downloading a changing gist. Home Manager writes it to `~/.local/share/easyeffects/output/FW13PRO.json`; edit the repo copy to persist changes, or save a separately named preset in the app for experiments.

Apply with the normal `sudo nixos-rebuild switch`. After changing the preset, reload it with `systemctl --user restart easyeffects`. Check the daemon with `systemctl --user status easyeffects` and open `easyeffects` to inspect the effects.

This is speaker tuning, but the startup preset follows the selected output device, including headphones, USB audio, or Bluetooth. Bypass the effects for those devices, or configure device-specific profiles in EasyEffects' Presets → Autoload tab. To rely exclusively on those profiles, remove `preset.output = "FW13PRO";` from the host configuration and rebuild; selecting an empty-effects preset for other devices avoids carrying the speaker tuning across device changes. This repo deliberately does not guess a PipeWire device name.

## One-time setup outside Nix

- YubiKey for sudo: `pamu2fcfg -N > ~/.config/Yubico/u2f_keys` (key needs its FIDO2 PIN)
- Fingerprint: `fprintd-enroll`
- Machine-local git settings (optional): `~/.config/git/local.gitconfig`
