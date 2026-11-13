# NixOS

Flake-based NixOS configurations, with Home Manager as a NixOS module. Everything (system, shell, editor, git) is declared here; nothing is symlinked from elsewhere.

## Apply

```sh
sudo nixos-rebuild switch --flake ~/Development/dotfiles/nixos#framework
```

## Update packages

```sh
nix flake update --flake ~/Development/dotfiles/nixos   # bumps flake.lock
sudo nixos-rebuild switch --flake ~/Development/dotfiles/nixos#framework
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
  users/austin.nix          the account, zsh login shell, Home Manager wiring
modules/home/             austin's Home Manager config, shared by all hosts
  shell.nix                 zsh, plugins, starship, atuin, zoxide, fzf, direnv
  emacs.nix + doom/         Doom Emacs (doom/*.el is the Doom config)
  git.nix                   git, gh, lazygit
  vscode.nix, agents.nix
```

New files must be `git add`ed before rebuilding: flakes only see files git tracks.

## Adding a machine

1. On the new machine: `nixos-generate-config --show-hardware-config > hosts/<name>/hardware-configuration.nix`
2. Create `hosts/<name>/default.nix` importing the modules it needs (copy `hosts/framework/default.nix` and trim). Set `system.stateVersion` and `home-manager.users.austin.home.stateVersion` to the release it was installed with.
3. Add `<name> = mkHost "<name>";` to `nixosConfigurations` in `flake.nix`.
4. `sudo nixos-rebuild switch --flake .#<name>`

## Doom Emacs

Doom and its packages are built by Nix ([nix-doom-emacs-unstraightened](https://github.com/marienz/nix-doom-emacs-unstraightened)), so there is no `doom sync`: edit `modules/home/doom/*.el` and rebuild. Emacs runs as a background service; `$EDITOR` is `emacsclient -t`. After a rebuild, restart it to load the new config: `systemctl --user restart emacs`.

## One-time setup outside Nix

- YubiKey for sudo: `pamu2fcfg -N > ~/.config/Yubico/u2f_keys` (key needs its FIDO2 PIN)
- Fingerprint: `fprintd-enroll`
- Machine-local git settings (optional): `~/.config/git/local.gitconfig`
