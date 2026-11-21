# Keyboard behaviour for every session (GNOME, Hyprland, GDM, text consoles).
#
# Caps Lock is Escape when tapped and Control when held; Control stays
# Control. XKB options (like ctrl:swapcaps) can only remap a key, not tell a
# tap from a hold, so keyd does it: a small daemon that reads the keyboard
# before any desktop sees it and passes on a remapped virtual keyboard.
# Because it sits underneath, the desktops need no remapping of their own.
{
  services.xserver.xkb = {
    layout = "us";
    variant = "";
  };

  services.keyd = {
    enable = true;
    # Written to /etc/keyd/default.conf.
    keyboards.default = {
      ids = [
        "*" # every keyboard...
        "-1050:0407" # ...except the YubiKey, which "types" one-time codes
        # ...and Mouseless's virtual keyboard: it reads keyd's output, so
        # letting keyd grab it too makes the two feed each other in a loop.
        "-4711:0815"
        "-4711:0816"
      ];
      settings = {
        main.capslock = "overload(control, esc)";
        # Escape only for a quick tap: press-and-release longer than this
        # (say, you hold Caps and change your mind) sends nothing, so evil
        # doesn't drop out of insert mode by accident.
        global.overload_tap_timeout = 200; # ms
      };
    };
  };

  # libinput would otherwise treat keyd's virtual keyboard as an external
  # one, and "disable touchpad while typing" stops working. (From keyd's docs.)
  environment.etc."libinput/local-overrides.quirks".text = ''
    [Serial Keyboards]
    MatchUdevType=keyboard
    MatchName=keyd virtual keyboard
    AttrKeyboardIntegration=internal
  '';
}
