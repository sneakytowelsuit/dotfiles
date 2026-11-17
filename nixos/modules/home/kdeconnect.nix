# KDE Connect (per-user side): the daemon that phones pair with, plus a tray
# icon. Both start with any graphical session (GNOME or Hyprland), so a phone
# paired once works in either. Turns on only where the system config enables
# KDE Connect (modules/nixos/kdeconnect.nix), since that opens the firewall.
#
# Pair: install KDE Connect on the phone, same Wi-Fi, then accept the request
# from the tray icon or run `kdeconnect-app`. `kdeconnect-cli --list-devices`
# shows what's paired and reachable.
{ lib, osConfig, ... }:

lib.mkIf osConfig.programs.kdeconnect.enable {
  services.kdeconnect = {
    enable = true;
    # Shows in Noctalia's bar tray under Hyprland. (GNOME has no tray without
    # an extension; use kdeconnect-app there.)
    indicator = true;
  };
}
