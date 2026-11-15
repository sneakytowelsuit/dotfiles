# What every graphical session needs, whichever desktop runs on top:
# the GDM login screen (it lists every installed session), sound and
# printing. Keyboard behaviour is in keyboard.nix; the desktops themselves
# live in gnome.nix, hyprland.nix, ...
{
  services.displayManager.gdm.enable = true;

  services.printing.enable = true;

  # Sound via PipeWire
  services.pulseaudio.enable = false;
  security.rtkit.enable = true;
  services.pipewire = {
    enable = true;
    alsa.enable = true;
    alsa.support32Bit = true;
    pulse.enable = true;
  };

  programs.firefox.enable = true;
}
