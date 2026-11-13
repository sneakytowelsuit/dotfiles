# zsh and the command-line tools that hook into it. Plugins come from nixpkgs,
# pinned by flake.lock, instead of a plugin manager downloading them at runtime.
{
  config,
  lib,
  pkgs,
  ...
}:

{
  programs.zsh = {
    enable = true;
    # Keep zsh's files in ~/.config/zsh instead of ~.
    dotDir = "${config.xdg.configHome}/zsh";

    enableCompletion = true;
    autosuggestion.enable = true;
    fastSyntaxHighlighting.enable = true;

    defaultKeymap = "viins"; # vi mode
    localVariables.KEYTIMEOUT = 1; # switch to normal mode without delay
    setOptions = [ "COMPLETE_IN_WORD" ]; # tab-complete in the middle of a word

    history = {
      size = 50000;
      ignoreDups = true;
      share = true;
    };

    shellAliases.gg = "lazygit";

    # Home Manager assembles .zshrc from ordered fragments (lib.mkOrder):
    # 570 = compinit, 700 = autosuggestions, 1000 = default, 1200 = highlighting.
    initContent = lib.mkMerge [
      # fzf-tab must load after compinit but before anything that wraps
      # widgets (autosuggestions, syntax highlighting).
      (lib.mkOrder 600 ''
        source ${pkgs.zsh-fzf-tab}/share/fzf-tab/fzf-tab.plugin.zsh
      '')
      ''
        # Edit the current command in $EDITOR with `v` in normal mode
        autoload -Uz edit-command-line
        zle -N edit-command-line
        bindkey -M vicmd 'v' edit-command-line

        # History navigation in insert and normal mode
        bindkey '^P' up-history
        bindkey '^N' down-history
        bindkey -M vicmd '^P' up-line-or-history
        bindkey -M vicmd '^N' down-line-or-history
      ''
    ];
  };

  # Extra completion definitions; zsh finds them through the user profile.
  home.packages = [ pkgs.zsh-completions ];

  programs.starship.enable = true; # prompt
  programs.fzf = {
    enable = true; # Ctrl-T file picker, used by fzf-tab
    historyWidget.command = ""; # leave Ctrl-R to atuin
  };
  programs.atuin.enable = true; # Ctrl-R searchable history
  programs.zoxide = {
    enable = true;
    options = [
      "--cmd"
      "cd"
    ]; # `cd` learns frequent directories
  };

  # Per-project environments: a directory with `.envrc` containing `use flake`
  # loads that project's devShell when you cd into it.
  programs.direnv = {
    enable = true;
    nix-direnv.enable = true;
  };
}
