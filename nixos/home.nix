{ pkgs, inputs, ... }:

{
  home.username = "austin";
  home.homeDirectory = "/home/austin";
  home.stateVersion = "26.05";

  imports = [ 
    ./vscode.nix 
    ./agents.nix 
    inputs.zen-browser.homeModules.beta
  ];

  programs.zen-browser.enable = true;
}
