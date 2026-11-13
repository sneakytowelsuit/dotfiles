# Doom Emacs, built by Nix with nix-doom-emacs-unstraightened.
#
# Doom itself and every Emacs package are pinned by flake.lock; ./doom holds
# the Doom config (init.el = modules, config.el = settings, packages.el =
# extra packages), which is copied into the build. There is no `doom sync`:
# edit the files and rebuild NixOS instead.
#
# Doom's own docs: SPC h d h inside Emacs, or https://docs.doomemacs.org
{ inputs, pkgs, ... }:

{
  imports = [ inputs.nix-doom-emacs-unstraightened.homeModule ];

  programs.doom-emacs = {
    enable = true;
    doomDir = ./doom;
    emacs = pkgs.emacs-pgtk; # native Wayland build (sharper on GNOME)
    # Programs Doom's modules call out to, put on Emacs' PATH.
    extraBinPackages = with pkgs; [
      git
      ripgrep
      fd
      nixd # Nix language server (:lang nix +lsp)
      nixfmt # Nix formatter (:editor format)
      bash-language-server # (:lang sh +lsp)
      shellcheck
      shfmt
    ];
  };

  # Run Emacs in the background so `emacsclient` opens instantly. Socket
  # activation starts it on first use; it also starts at login.
  services.emacs = {
    enable = true; # uses the Doom package automatically
    socketActivation.enable = true;
    startWithUserSession = "graphical";
    client.enable = true; # "Emacs (Client)" entry in the app launcher
  };

  # Terminal editor for git commits, sudoedit, `v` in zsh, etc.
  home.sessionVariables = {
    EDITOR = "emacsclient -t";
    VISUAL = "emacsclient -t";
  };

  # Icon font used by Doom's modeline and file icons.
  fonts.fontconfig.enable = true;
  home.packages = [ pkgs.nerd-fonts.symbols-only ];
}
