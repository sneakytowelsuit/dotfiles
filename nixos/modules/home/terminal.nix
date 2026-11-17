# Terminals: the Herdr desktop app day to day, Ghostty as the dependable
# fallback, and the Herdr TUI for running agents inside any terminal.
{ pkgs, ... }:

{
  # The Dungeon Crawler Carl layout, linked into ~/.config/herdr-app.
  imports = [ ./herdr-layout.nix ];

  # Packaged in this repo (pkgs/herdr-app); brings nixpkgs' herdr-core with it.
  home.packages = [ pkgs.herdr-app ];

  programs.ghostty = {
    enable = true;
    # Written to ~/.config/ghostty/config. Carried over from Aurora.
    settings = {
      font-family = "monospace";
      font-size = 11;
      window-padding-x = 8;
      window-padding-y = 8;
    };
  };

  # The terminal-based herdr (a different program from the desktop app).
  programs.herdr.enable = true;
}
