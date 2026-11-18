# Settings every machine gets, desktop or not.
{
  config,
  inputs,
  lib,
  pkgs,
  ...
}:

{
  # Adds this repo's own packages (pkgs/) to `pkgs`. Home Manager shares this
  # pkgs (useGlobalPkgs), so they're available there too.
  nixpkgs.overlays = [ inputs.self.overlays.default ];

  nix.settings = {
    experimental-features = [
      "nix-command"
      "flakes"
    ];
    # Hard-link identical files in the store to save space.
    auto-optimise-store = true;
    # Prebuilt Doom Emacs packages, so they don't all compile locally.
    extra-substituters = [ "https://doom-emacs-unstraightened.cachix.org" ];
    extra-trusted-public-keys = [
      "doom-emacs-unstraightened.cachix.org-1:O5oOlRPnmQEvVaFyuMTmthCEooHbrg54WgSLR07tmg4="
    ];
  };
  nix.gc = {
    automatic = true;
    dates = "daily";
    options = "--delete-older-than 30d";
  };
  # Flake-only system: no channels. `nix-shell -p` and `nix run nixpkgs#…`
  # still work and use this flake's pinned nixpkgs.
  nix.channel.enable = false;

  nixpkgs.config.allowUnfree = true;

  networking.networkmanager.enable = true;

  time.timeZone = "America/Los_Angeles";
  i18n.defaultLocale = "en_US.UTF-8";

  # System-wide basics, available to root too. Per-user tools and their
  # configuration live in Home Manager (modules/home).
  programs.git.enable = true;
  environment.systemPackages = [
    pkgs.vim
    # nixd (Emacs/VS Code Nix LSP) keeps two `nixd-attrset-eval` workers alive,
    # each holding a nix-daemon connection with a shared lock on
    # /nix/var/nix/db/big-lock. A root `nix-instantiate` in nixos-rebuild then
    # blocks on that lock for minutes. Kill the workers first; nixd and Eglot
    # keep running (diagnostics, formatting, go-to-definition), and
    # `M-x eglot-reconnect` brings back nixpkgs/option completion.
    (lib.hiPrio (
      pkgs.writeShellScriptBin "nixos-rebuild" ''
        ${pkgs.procps}/bin/pkill -KILL -x nixd-attrset-eval || true
        exec ${config.system.build.nixos-rebuild}/bin/nixos-rebuild "$@"
      ''
    ))
  ];
}
