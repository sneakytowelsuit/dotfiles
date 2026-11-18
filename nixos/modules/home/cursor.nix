# The mouse cursor, in every session (GNOME and Hyprland).
#
# Bibata Modern Classic: a large black arrow with a white outline, so it stays
# easy to find on light and dark backgrounds, and a full set of shapes (pointing
# hand over links, text beam, grab, resize arrows, ...) that apps ask for by name
# as you hover things. Hyprland had no theme set at all, so it drew its bare
# fallback, which has none of those.
#
# Hyprland reads its own copy of the theme name and size in hypr/10-settings.lua
# (a UWSM session doesn't reliably see Home Manager's session variables): change
# them together. Other themes in nixpkgs: bibata-cursors has Modern-Ice (white)
# and Original-Classic/Ice variants too; catppuccin-cursors, rose-pine-cursor,
# capitaine-cursors and vimix-cursors are alternatives. The size is in logical
# pixels; the laptop panel runs at 2x, so 32 is 64 real pixels.
{ pkgs, ... }:

let
  name = "Bibata-Modern-Classic";
  size = 16;
in
{
  home.pointerCursor = {
    enable = true;
    package = pkgs.bibata-cursors;
    inherit name size;
    gtk.enable = true; # GTK apps, via gtk-3.0/gtk-4.0 settings.ini
  };
  gtk.enable = true; # needed for the line above to write anything

  # GNOME (and GTK apps in any session) read the cursor from gsettings.
  dconf.settings."org/gnome/desktop/interface" = {
    cursor-theme = name;
    cursor-size = size;
  };
}
