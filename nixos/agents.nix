{pkgs, ...}: {

  home.packages = with pkgs; [
    claude-code
  ];

  programs.claude-code.enable = true;
}