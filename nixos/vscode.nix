{ pkgs, ... }:

{
  home.packages = with pkgs; [
    nixd
    nixfmt
  ];

  programs.vscode = {
    enable = true;

    profiles.default = {
      extensions = with pkgs.vscode-extensions; [
        jnoortheen.nix-ide
        vscodevim.vim
      ];

      userSettings = {
        # Nix language support and LSP
        "nix.enableLanguageServer" = true;
        "nix.serverPath" = "${pkgs.nixd}/bin/nixd";
        "nix.serverSettings" = {
          nixd.formatting.command = [ "${pkgs.nixfmt}/bin/nixfmt" ];
        };

        # Format Nix files on save
        "[nix]"."editor.formatOnSave" = true;

        # Vim extension
        "vim.enable" = true;
      };
    };
  };
}
