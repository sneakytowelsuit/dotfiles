# Mouseless: keyboard-driven mouse control. Config lives in ./mouseless/config.yaml.
# Needs the user in the `input` and `uinput` groups (see ../nixos/users/austin.nix).
{ pkgs, ... }:

let
  # Mouseless takes device paths, but keyd's virtual keyboard gets a different
  # /dev/input/eventN each boot. Look it up by name and write the config with
  # the real path into the runtime dir.
  start = pkgs.writeShellScript "mouseless-start" ''
    dev=$(${pkgs.gawk}/bin/awk '
      /^N: Name="keyd virtual keyboard"/ { hit = 1 }
      hit && /^H: Handlers=/ { match($0, /event[0-9]+/); print substr($0, RSTART, RLENGTH); exit }
      /^$/ { hit = 0 }
    ' /proc/bus/input/devices)
    [ -n "$dev" ] || { echo "keyd virtual keyboard not found" >&2; exit 1; }
    cfg="$XDG_RUNTIME_DIR/mouseless.yaml"
    ${pkgs.gnused}/bin/sed "s|@KEYD_DEVICE@|/dev/input/$dev|" \
      "$HOME/.config/mouseless/config.yaml" > "$cfg"
    exec ${pkgs.mouseless}/bin/mouseless --config "$cfg"
  '';
in
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
      ExecStart = "${start}";
      Restart = "on-failure";
      RestartSec = 3;
    };
    Install.WantedBy = [ "graphical-session.target" ];
  };
}
