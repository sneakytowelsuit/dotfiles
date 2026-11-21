{
  # Installs claude-code and manages its config.
  programs.claude-code.enable = true;

  # Installs codex (from nixpkgs, with its bubblewrap sandbox dependency wired up).
  programs.codex.enable = true;
}
