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

    # Every tree-sitter grammar, prebuilt against this Emacs, so no
    # "install grammar?" prompts (used by the +tree-sitter flags in init.el).
    extraPackages = epkgs: [ epkgs.treesit-grammars.with-all-grammars ];

    # Programs Doom's modules call out to, put on Emacs' PATH only. The names
    # are the ones eglot looks for. Compilers/runtimes (cargo, node, jdk...)
    # are left to each project's devShell so versions match the project.
    extraBinPackages = with pkgs; [
      # Doom core
      git
      ripgrep
      fd

      # Nix
      nixd
      nixfmt
      # Shell
      bash-language-server
      shellcheck
      shfmt
      # Go (gopls needs the go toolchain; gofmt comes with it)
      gopls
      go
      # Rust
      rust-analyzer
      rustfmt
      # JavaScript / TypeScript
      typescript-language-server
      typescript
      prettier # also formats JSON, YAML, Markdown, HTML, CSS
      # Python
      pyright
      black
      # C / C++ (clangd, clang-format)
      clang-tools
      # Lua
      lua-language-server
      stylua
      # Config and markup files
      vscode-langservers-extracted # JSON, HTML, CSS, ESLint
      yaml-language-server
      tombi # TOML
      marksman # Markdown
      dockerfile-language-server
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
