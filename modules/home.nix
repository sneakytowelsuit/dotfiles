{ pkgs, lib, ... }:
let
    home-manager = builtins.fetchTarball {
      url = "https://github.com/nix-community/home-manager/archive/release-24.11.tar.gz";
    };
in
{
  imports = [
    # Include home manager
    (import "${home-manager}/nixos")
  ];

  home-manager.users.austin = { pkgs, ... }: {
    home.packages = with pkgs; [
      htop
      neofetch
      atuin
      bat
    ];

    programs.zsh = {
      enable = true;
      autosuggestion = {
        enable = true;
        highlight = "fg=#ff00ff,bg=cyan,bold,underline";
      };
      defaultKeymap = "viins";
      syntaxHighlighting.enable = true;
      enableCompletion = true;
      autocd = true;
      history = {
        # Multiple sessions append to history file rather than replace it
        append = true;
        expireDuplicatesFirst = true;
        # Save timestamps to history file
        extended = true;
        ignoreSpace = true;
        share = true;
      };
      historySubstringSearch = {
        enable = true;
        searchDownKey = "^n";
        searchUpKey = "^p";
      };
      initExtra = lib.mkAfter ''
          source ${pkgs.zsh-powerlevel10k}/share/zsh-powerlevel10k/powerlevel10k.zsh-theme
          test -f ~/.p10k.zsh && source ~/.p10k.zsh
          eval "$(direnv hook zsh)"
      ''; 
    };

    programs.atuin = {
      enable = true;
      enableZshIntegration = true;
    };

    programs.vscode = {
      enable = true;
      package = pkgs.vscodium;
      extensions = with pkgs.vscode-extensions; [
        dracula-theme.theme-dracula
        vscodevim.vim
        yzhang.markdown-all-in-one
        yoavbls.pretty-ts-errors
        ziglang.vscode-zig
        tiehuis.zig
        mkhl.direnv
        bbenoist.nix
        kamadorueda.alejandra
        jnoortheen.nix-ide
        jeff-hykin.better-nix-syntax
        golang.go
      ];
    };

    programs.git = {
      enable = true;
      userEmail = "60020423+sneakytowelsuit@users.noreply.github.com";
      userName = "sneakytowelsuit";
    };

    # Must match the version of home-manager installed before in the fetchTarball call
    home.stateVersion = "24.11";
  };
}
