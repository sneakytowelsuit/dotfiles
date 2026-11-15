# Handoff: NixOS setup → learning Emacs and trying window managers

Written 2026-11-12 at commit `30bdca6`; updated 2026-11-14 after the terminal, Hyprland and keyboard work. It is for a new agent (or future me) picking this up cold. Read it fully before changing anything; `nixos/README.md` covers day-to-day commands.

## Who this is for and how to work with them

- Austin is fairly new to Nix but wants to **understand** it: explain *why* something is idiomatic, not just what to type. Prefer teaching over doing everything silently.
- Goal is **long-term maintainability** and **idiomatic Nix**.
- **Everything should be declared in Nix**: Home Manager options rather than symlinking config files from the repo. The one accepted exception is Doom Emacs, whose config is Emacs Lisp (see below).
- `aurora/` is the previous OS's config (Aurora DX). The NixOS config is allowed to drift from it; don't keep them in sync.

## Machine and current state

- **Framework Laptop 13 Pro**, Intel Core Ultra X7 358H (Core Ultra Series 3), hostname `framework`.
- NixOS **unstable** (26.11 pre-release); `system.stateVersion` and `home.stateVersion` are `26.05`. Do not bump them.
- Disk: unencrypted btrfs (subvolumes `/`, `/home`, `/nix`), 1 GiB `/boot`, swap partition.
- Desktop: **GDM** with two sessions: **Hyprland (UWSM)** (new, see below) and **GNOME** (kept as the fallback). The plain "Hyprland" GDM entry skips UWSM; don't use it.
- Shell: **zsh** (login shell). Editor: **Doom Emacs**, with `$EDITOR=emacsclient -t`.
- Terminal: **Herdr desktop app** (packaged in `pkgs/herdr-app`), **Ghostty** as fallback, **herdr TUI**.
- Keyboard: **keyd** makes Caps Lock Escape on tap, Control on hold (`modules/nixos/keyboard.nix`).
- Auth: YubiKey (FIDO2 PIN + touch), then fingerprint, then password, for sudo, polkit and login.
- Everything below was applied, tested after logout/login, and merged to `main`.

## Repository layout (NixOS part)

```
nixos/flake.nix              inputs + mkHost helper; `framework = mkHost "framework";`
nixos/hosts/framework/       machine-specific: hardware, boot, NPU, fprintd, stateVersions
nixos/modules/nixos/         base.nix, desktop.nix (shared: GDM, sound, printing), gnome.nix, hyprland.nix,
                             keyboard.nix (keyd), yubikey.nix, users/austin.nix
nixos/modules/home/          Home Manager: shell.nix, git.nix, emacs.nix + doom/, vscode.nix, agents.nix,
                             terminal.nix, hyprland.nix + hypr/*.lua
nixos/pkgs/                  packages this repo defines (herdr-app), added to pkgs via overlays.default
.luarc.json (repo root)      points lua-language-server at Hyprland's stubs (~/.config/hypr/stubs)
```

Flake inputs: nixpkgs (nixos-unstable), nixos-hardware, home-manager (master), nix-doom-emacs-unstraightened, zen-browser. Home Manager runs as a NixOS module (`useGlobalPkgs`, `useUserPackages`, `backupFileExtension = "backup"`). `inputs` is passed to modules through `specialArgs` / `extraSpecialArgs`.

## How to make changes (conventions that worked)

1. Work on a branch, not `main`. Austin has approved merging to `main` after testing, but ask each time.
2. Edit, then `git add` any **new** files: flakes only see files git tracks.
3. Run `nix fmt` (nixfmt-tree) in `nixos/`.
4. **Verify before asking Austin to switch:**
   - `nix eval --json .#nixosConfigurations.framework.config.warnings` and `…config.home-manager.users.austin.warnings` should both be `[]`.
   - `nix build --no-link --print-out-paths .#nixosConfigurations.framework.config.system.build.toplevel`
   - `nix store diff-closures /run/current-system <out>` shows what will change.
5. **The agent cannot run `sudo`:** it needs Austin's password, YubiKey or fingerprint. Ask him to run `! sudo nixos-rebuild switch`. `/etc/nixos` is a symlink to `~/Development/dotfiles/nixos`, so the bare command builds this repo's `framework` configuration, chosen by hostname. The explicit `--flake ~/Development/dotfiles/nixos#framework` form also works.
6. Commit messages end with a `Co-Authored-By` line. git identity is set by Home Manager (`modules/home/git.nix`).

## What happened (in order)

1. **Fixed the broken flake.** `home.nix` used `inputs` without anything passing it, which caused an infinite recursion. Fixed with `@inputs`, `specialArgs` and `extraSpecialArgs`.
2. **Added basics:** neovim (later replaced), git, gh, and YubiKey + fingerprint PAM. The deprecated `u2fAuth` per-service block was removed: enabling `security.pam.u2f` and `services.fprintd` already adds both to sudo and polkit.
3. **YubiKey quirk:** the key has `alwaysUv` **locked on** (it can't be disabled) and a minimum PIN length of **8**. So u2f is registered with `pamu2fcfg -N > ~/.config/Yubico/u2f_keys` and sudo asks for the key's PIN plus a touch. Ctrl+C at the PIN prompt aborts all of sudo; to test the fingerprint, remove the key or press Enter with an empty PIN.
4. **Moved the config into this repo** (`nixos/`), replacing an earlier abandoned attempt, and renamed the host from `nixos` to `framework`.
5. **Cleanup:**
   - Removed duplicate installs.
   - `nix.channel.enable = false`, `auto-optimise-store`, systemd-boot `configurationLimit = 10`.
   - Added nixos-hardware `framework-intel-core-ultra-series3` (adds fwupd and Intel GPU media/compute drivers).
   - Added the `nix fmt` formatter.
6. **Split into hosts and modules** for future machines (Austin expects to add more).
7. **zsh in Nix** (`shell.nix`):
   - Plugins come from nixpkgs instead of zinit: fzf-tab, autosuggestions, fast-syntax-highlighting, zsh-completions.
   - Tools: starship, atuin (owns Ctrl-R), zoxide (`--cmd cd`), fzf, lazygit, direnv + nix-direnv.
   - **mise was dropped**: its downloaded binaries don't run on NixOS. Use per-project flake devShells with direnv instead.
   - Bash history was imported into atuin.
8. **Editor:** a nixvim config was written, then replaced by **Doom Emacs** at Austin's request.
9. **Doom language support:**
   - All tree-sitter grammars installed (`treesit-grammars.with-all-grammars`).
   - `+lsp +tree-sitter` for Go, Rust, JS/TS, Python, C/C++, Lua, Nix, JSON, YAML, Markdown, web, Docker; also toml (via the `data` module), editorconfig and make.
   - LSP is **eglot** (`(lsp +eglot)`). The language servers are in `extraBinPackages` in `emacs.nix`.
   - **Java was skipped**: opening a `.java` file hung Emacs.

## Doom Emacs: how it is wired (read before touching it)

- Built by **nix-doom-emacs-unstraightened** (`modules/home/emacs.nix`). Doom and every package are pinned by `flake.lock`. Config lives in `nixos/modules/home/doom/`:
  - `init.el`: which Doom modules are on.
  - `config.el`: personal settings.
  - `packages.el`: extra packages.
- **There is no `doom sync`.** To change the config: edit the `.el` files, rebuild NixOS, then run `systemctl --user restart emacs`.
- Emacs is `emacs-pgtk` (native Wayland). It runs as a **socket-activated user service** that also starts at graphical login. `emacsclient -t` is `$EDITOR`/`$VISUAL`, and an "Emacs (Client)" desktop entry exists.
- Doom's package cache (`doom-emacs-unstraightened.cachix.org`) is trusted in `modules/nixos/base.nix`.
- `config.el` patches gaps in eglot's built-in server list: `nix-ts-mode` → nixd, HTML in `web-mode` → vscode-html-language-server. It also remaps `conf-toml-mode` to `toml-ts-mode`.
- **To add a language:** turn on the module with `+lsp +tree-sitter` in `init.el`, then add the server's executable to `extraBinPackages`. Check the executable name eglot expects in `eglot-server-programs`. Compilers and runtimes (cargo, node, jdk) belong in project devShells, not here.
- **Headless testing**, to verify config without disturbing Austin's session:
  - Build `…home-manager.users.austin.programs.doom-emacs.finalEmacsPackage`.
  - Start a separate daemon with `emacs --daemon=<name>` and query it with `emacsclient -s <name> --eval`.
  - Stop it with `--eval '(kill-emacs)'`. A `pkill -f` pattern can match your own shell command, and the wrapper re-execs with an `--init-directory` argument, so target the PID instead.

## Next step 1: learning Emacs (Doom)

Austin has used vim, and Doom runs **evil** (vim keybindings), so normal-mode editing transfers. What's new is Emacs' model (buffers, windows, major/minor modes, the minibuffer, `M-x`) and Doom's `SPC` leader menus.

A suggested path, teaching one layer at a time:
1. **Navigation via `SPC`:**
   - `SPC .` find file, `SPC f r` recent files, `SPC b b` switch buffer.
   - `SPC p p` switch project, `SPC s p` search in project.
   - `SPC w` window commands, `SPC h` help.
   - Pausing after `SPC` shows which-key hints.
2. **Help system** (the most important Emacs skill):
   - `SPC h d h` Doom docs, `SPC h k` describe key, `SPC h f` and `SPC h v` describe function/variable.
   - `SPC h m` lists the active modes in the current buffer.
3. **Magit** (`SPC g g`): stage hunks, commit, push. A good daily-use win.
4. **LSP in practice:** `gd` definition, `K` docs, `SPC c a` code actions, `SPC c r` rename, `SPC c x` diagnostics. Try it on this repo's `.nix` files.
5. **Configuring:** make a small change in `doom/config.el`, such as a font (`doom-font`), theme (`doom-theme`), or a `map!` keybinding. Rebuild, then restart the emacs service. This teaches the edit → rebuild → restart loop.
6. **Elisp basics:**
   - `setq`, `after!`, `map!`, `add-hook!`.
   - Evaluate expressions live with `SPC :` / `M-:`, or `eval-region` in a scratch buffer (`SPC x`). Changes made live are lost on restart unless written to `config.el`.
7. **Later:** org-mode (already enabled, `org-directory` is `~/org/`), and `:term vterm` for a terminal inside Emacs (not yet enabled; it needs `+` flags and a rebuild).

Related setup ideas, once comfortable:
- Set `doom-font` to a font installed through Nix: add it to `home.packages`, since fontconfig is already enabled.
- `services.emacs.client` gives the GUI client; a keyboard shortcut to `emacsclient -c` makes Emacs feel native.
- Optional: Austin could replace VS Code (`modules/home/vscode.nix`) once Emacs feels comfortable. Don't remove it unprompted.

## Hyprland: how it is wired (read before touching it)

- **Config is Lua.** Hyprland 0.55 introduced `hyprland.lua`, and 0.57 dropped `hyprland.conf` entirely. Like Doom's Elisp, it's kept as real files in `modules/home/hypr/` (`10-settings.lua`, `20-binds.lua`, `30-rules.lua`, loaded in name order through Home Manager's `extraLuaFiles`). Nix only wires them in.
- **Checked at build time:** `modules/home/hyprland.nix` runs `Hyprland --verify-config` on those files in a derivation. A bad option, rule field or dispatcher argument fails `nixos-rebuild` with Hyprland's error message. The check does **not** validate `hl.dsp.layout("…")` message strings, so test new ones live.
- **Authoritative API reference:** `<hyprland pkg>/share/hypr/hyprland.lua` (the example config) and `share/hypr/stubs/hl.meta.lua`. The wiki is often ahead of the packaged version.
- **UWSM** (`programs.hyprland.withUWSM = true`) runs the session as systemd units and reaches `graphical-session.target`. It is also the package variant in the binary cache: with `withUWSM = false`, NixOS recompiles Hyprland locally. Home Manager's `wayland.windowManager.hyprland.systemd.enable` is therefore `false`, and `package`/`portalPackage` are `null` (the NixOS module installs them).
- **Layout:** the built-in `scrolling` layout (niri-like). The binds are ported from `aurora/dotfiles/.config/niri`:
  - `Super+Ctrl+H/L` swap whole columns (`swapcol`); `Ctrl+J/K` move a window within its column.
  - A three-finger horizontal swipe is `scroll_move` (scrolls the tape); vertical is `workspace`.
  - The column swap and the swipe pass the config check but were **not tested live**. Ask Austin whether they behave.
- **Noctalia v5** is the whole shell: bar, launcher, notifications, lock screen (PAM service `login`), fingerprint via fprintd D-Bus, idle lock/screen-off, OSD, screenshots, wallpaper and polkit agent. It is configured in `programs.noctalia.settings` (TOML). Settings-window changes go to `~/.local/state/noctalia/settings.toml` and override Nix. Its systemd unit has an `ExecCondition` so it only starts when `XDG_CURRENT_DESKTOP` is Hyprland (GNOME also reaches `graphical-session.target`). `noctalia config export full` prints every option with its default.
- **wlr-which-key** on `Super+Space` (menu defined in `hyprland.nix`). Each entry shows its direct bind. Key names are keysyms (`Tab`, not `tab`); a bad one makes it exit with a parse error.
- **Editor support:** the repo-root `.luarc.json` points lua-language-server at `~/.config/hypr/stubs`, a Home Manager link to the package's stubs. It must sit at the repo root: Doom's `project-find-functions` puts projectile first, which gives eglot the git root. Verified headless: diagnostics, completion and hover (`K`) for `hl`.
- **Testing in a nested Hyprland** (`Hyprland -c <test.lua>` inside a running session) works well, **but `hyprctl -i 0` targets the first instance, which may be Austin's real session.** On 2026-11-14, `hyprctl -i 0 dispatch 'hl.dsp.exit()'` ended his live session. Never run nested tests while he's logged into Hyprland without asking. Address a test instance only by its own signature (`hyprctl instances`, matching the PID you started), and prefer `Hyprland --verify-config` when it's enough.
- **keyd** (`modules/nixos/keyboard.nix`) does Caps = Esc/Ctrl below every session, so there are no `kb_options`/`xkb.options` remaps. The YubiKey (`1050:0407`) is excluded. A libinput quirk keeps "disable touchpad while typing" working.

## Herdr desktop app

- `pkgs/herdr-app/package.nix`: upstream's prebuilt tarball, patched with `autoPatchelfHook`. `runtimeDependencies` cover the libraries it `dlopen`s (Vulkan, Wayland, EGL). The wrapper puts nixpkgs' `herdr-core` on `PATH` and sets `HERDR_TELEMETRY=0`.
- **Update:** take the version and sha256 from `https://releases.herdr.dev/app/latest.json`. Ignore the app's own updater (it can't write to the store).
- herdr-core runs as a `systemd-run` user unit (`hc-serve-*`). `users.users.austin.linger = true` keeps it, and the terminals in it, alive across logouts.
- `~/.config/herdr-app/` is deliberately **not** managed by Nix: the app writes its own settings there.

## Other open items

- [ ] **Delete `/etc/nixos.old`**: it's the original config copy. It was verified to hold nothing not already in git (it differs only in the old hostname). It was moved aside so `/etc/nixos` could become a symlink to the repo: a stale `/etc/nixos/flake.nix` would otherwise be built by a bare `nixos-rebuild switch` and roll the system back. Deleting it needs `sudo rm -r /etc/nixos.old`, so Austin runs it when he's comfortable.
- [ ] **LUKS disk encryption:** deferred. The disk is unencrypted, so it needs a reinstall, or an in-place `cryptsetup reencrypt` (riskier). Once LUKS exists, unlock with `systemd-cryptenroll --fido2-device=auto --fido2-with-client-pin=yes` plus `boot.initrd.systemd.enable = true` and `crypttabExtraOpts = [ "fido2-device=auto" ]`. Keep a passphrase slot as a fallback. Consider disko for declarative partitioning.
- [ ] **Project devShells:** show Austin a per-project `flake.nix` devShell + `.envrc` (`use flake`) workflow, which replaces mise.
- [ ] **Java in Doom:** skipped because opening `.java` hung Emacs (cause not investigated).
- [ ] **Remote branches:** three unmerged branches (`codex/fix-setup-scripts-for-aurora-compatibility`, `feat/mise-workstation`, `init-flakes`) were left untouched. Don't delete them without asking.
- [ ] `~/.config/Code/User/settings.json.backup` is the pre-Home-Manager VS Code settings file. Safe to delete once Austin confirms he doesn't need anything from it.
- [ ] **Hyprland follow-ups:** confirm the live behaviour of the column swap and the swipe, and of the lock screen with YubiKey PIN, fingerprint and password. Not ported from niri yet: overview, `Mod+Home/End`, window-height binds.
- [ ] **Branches:** `feat/terminals` and `feat/hyprland` were merged to `main` (2026-11-14); they can be deleted when Austin agrees.
