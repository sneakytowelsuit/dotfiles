# Home Manager configuration for austin, shared by every host.
# username/homeDirectory are filled in automatically because Home Manager runs
# as a NixOS module; home.stateVersion is set per host.
{ inputs, ... }:

{
  imports = [
    inputs.zen-browser.homeModules.beta
    ./agents.nix
    ./git.nix
    ./emacs.nix
    ./shell.nix
    ./vscode.nix
  ];

  # Use ~/.config, ~/.local/share, ... for programs that support it.
  xdg.enable = true;

  programs.zen-browser.enable = true;
}
