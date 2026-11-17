# KDE Connect (system side): lets the phone reach this machine. The daemon and
# tray icon run per user, in modules/home/kdeconnect.nix, which turns itself on
# only for hosts that import this file.
{
  programs.kdeconnect = {
    # Opens TCP and UDP 1714-1764 in the firewall, which KDE Connect uses to
    # find and talk to paired devices on the local network. That is every
    # interface, public Wi-Fi included; pairing still needs approval on both ends.
    enable = true;
    # Home Manager installs the app for the user; nothing to add system-wide.
    package = null;
  };
}
