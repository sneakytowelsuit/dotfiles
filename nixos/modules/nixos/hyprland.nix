# Hyprland session (system side). The per-user config — keybindings, the
# Noctalia shell, wlr-which-key — is in modules/home/hyprland.nix, which turns
# itself on only for hosts that import this file.
{ pkgs, ... }:

{
  # Installs Hyprland, adds a "Hyprland" entry to GDM's session menu, and sets
  # up its xdg-desktop-portal (screen sharing, screenshots).
  programs.hyprland.enable = true;
  # Start it through UWSM, which runs the session as proper systemd units
  # (graphical-session.target etc.). Pick "Hyprland (UWSM)" in GDM. This is
  # also the variant of the package the binary cache has; without it NixOS
  # recompiles Hyprland locally.
  programs.hyprland.withUWSM = true;

  # GNOME brings most of these along today; declare what Noctalia relies on
  # here so the Hyprland session doesn't silently depend on GNOME's module.
  services.upower.enable = true; # battery
  services.power-profiles-daemon.enable = true; # power profile switcher
  hardware.bluetooth.enable = true;
  networking.networkmanager.enable = true;
  # Secret Service: Noctalia encrypts clipboard history with a key kept here,
  # and GDM's PAM unlocks the keyring at login.
  services.gnome.gnome-keyring.enable = true;

  # File-open dialogs and other portals Hyprland's own portal doesn't cover.
  xdg.portal.extraPortals = [ pkgs.xdg-desktop-portal-gtk ];

  # Electron/Chromium apps (VS Code, ...) run natively on Wayland.
  environment.sessionVariables.NIXOS_OZONE_WL = "1";
}
