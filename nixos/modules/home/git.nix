{
  # Written to ~/.config/git/config.
  programs.git = {
    enable = true;
    settings = {
      user = {
        name = "Austin Stowe";
        email = "60020423+sneakytowelsuit@users.noreply.github.com";
      };
      init.defaultBranch = "main";
    };
    # Untracked, per-machine overrides (e.g. a work email or signing key).
    # Git silently skips it when the file doesn't exist.
    includes = [ { path = "~/.config/git/local.gitconfig"; } ];
  };

  programs.gh = {
    enable = true;
    settings.git_protocol = "ssh";
  };

  programs.lazygit.enable = true;
}
