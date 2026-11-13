# System configuration for the Framework 13 Pro.
# Options: https://search.nixos.org/options or `man configuration.nix`.
{ pkgs, ... }:

{
  imports = [ ./hardware-configuration.nix ];

  # --- Nix ------------------------------------------------------------------
  nix.settings = {
    experimental-features = [
      "nix-command"
      "flakes"
    ];
    # Hard-link identical files in the store to save space.
    auto-optimise-store = true;
  };
  nix.gc = {
    automatic = true;
    dates = "daily";
    options = "--delete-older-than 30d";
  };
  # Flake-only system: no channels. `nix-shell -p` and `nix run nixpkgs#…`
  # still work and use this flake's pinned nixpkgs.
  nix.channel.enable = false;

  nixpkgs.config.allowUnfree = true;

  # --- Boot -----------------------------------------------------------------
  boot.loader.systemd-boot = {
    enable = true;
    # Keep /boot (1 GiB) from filling up with old generations.
    configurationLimit = 10;
  };
  boot.loader.efi.canTouchEfiVariables = true;

  # --- Hardware -------------------------------------------------------------
  # Framework-specific tuning (incl. fwupd) comes from nixos-hardware in flake.nix.
  hardware.cpu.intel.npu.enable = true;

  # --- Networking & locale --------------------------------------------------
  networking.hostName = "framework";
  networking.networkmanager.enable = true;

  time.timeZone = "America/Los_Angeles";
  i18n.defaultLocale = "en_US.UTF-8";

  # --- Desktop --------------------------------------------------------------
  services.displayManager.gdm.enable = true;
  services.desktopManager.gnome.enable = true;

  services.xserver.xkb = {
    layout = "us";
    variant = "";
    options = "ctrl:swapcaps"; # swap Caps Lock and Ctrl
  };

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

  # --- Authentication -------------------------------------------------------
  # Both modules add themselves to sudo, polkit and login by default; order is
  # YubiKey -> fingerprint -> password.
  services.fprintd.enable = true;

  # YubiKey keys are read from ~/.config/Yubico/u2f_keys (`pamu2fcfg -N`).
  security.pam.u2f = {
    enable = true;
    settings.cue = true; # print "Please touch the device" when waiting
  };

  # --- Users ----------------------------------------------------------------
  users.users.austin = {
    isNormalUser = true;
    description = "Austin";
    extraGroups = [
      "networkmanager"
      "wheel"
    ];
  };

  # --- Programs -------------------------------------------------------------
  # Per-user apps and their settings live in Home Manager (home.nix).
  programs.firefox.enable = true;

  programs.neovim = {
    enable = true;
    defaultEditor = true; # sets $EDITOR
  };

  programs.git.enable = true;

  environment.systemPackages = with pkgs; [
    vim
    gh
    pam_u2f # provides `pamu2fcfg` for registering YubiKeys
  ];

  # The NixOS release this machine was first installed with. It is NOT the
  # version you run and must not be bumped on upgrades: it keeps stateful
  # defaults (databases, file layouts) compatible with existing data.
  system.stateVersion = "26.05";
}
