# Home Manager entry point. username/homeDirectory are filled in automatically
# because Home Manager runs as a NixOS module.
{ inputs, ... }:

{
  imports = [
    ./vscode.nix
    ./agents.nix
    inputs.zen-browser.homeModules.beta
  ];

  programs.zen-browser.enable = true;

  # Like system.stateVersion: the release first installed with; don't bump.
  home.stateVersion = "26.05";
}
