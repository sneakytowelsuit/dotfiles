# Mouseless: keyboard-driven mouse control. Config lives in ./mouseless/config.yaml.
# Needs the user in the `input` and `uinput` groups (see ../nixos/users/austin.nix).
{ pkgs, ... }:

{
  home.packages = [ pkgs.mouseless ];

  xdg.configFile."mouseless/config.yaml".source = ./mouseless/config.yaml;

  systemd.user.services.mouseless = {
    Unit = {
      Description = "Mouseless keyboard-driven mouse";
      PartOf = [ "graphical-session.target" ];
      After = [ "graphical-session.target" ];
    };
    Service = {
      ExecStart = "${pkgs.mouseless}/bin/mouseless --config %h/.config/mouseless/config.yaml";
      Restart = "on-failure";
    };
    Install.WantedBy = [ "graphical-session.target" ];
  };
}
