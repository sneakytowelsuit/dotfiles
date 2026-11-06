{ pkgs, ... }:

{
  networking.hostName = "framework";
  time.timeZone = "America/Los_Angeles";

  boot.loader.systemd-boot.enable = true;
  boot.loader.efi.canTouchEfiVariables = true;
  # Framework's guide calls for the non-LTS kernel on this laptop.
  boot.kernelPackages = pkgs.linuxPackages_latest;

  networking.networkmanager.enable = true;
  hardware.bluetooth.enable = true;
  services.fprintd.enable = true;
  services.pipewire = {
    enable = true;
    alsa.enable = true;
    pulse.enable = true;
  };

  # Niri is the daily desktop; Plasma remains the fallback session.
  services.displayManager.sddm = {
    enable = true;
    wayland.enable = true;
  };
  services.desktopManager.plasma6.enable = true;
  programs.niri.enable = true;
  services.displayManager.defaultSession = "niri";
  # Niri binds Super+Alt+L to swaylock, which needs its own PAM service.
  security.pam.services.swaylock = { };

  # plugins.zsh runs compinit itself, after adding completion functions to fpath.
  programs.zsh = {
    enable = true;
    enableGlobalCompInit = false;
  };
  # Mise and Mason download generic Linux binaries, which need a dynamic loader.
  programs.nix-ld.enable = true;
  programs.firefox.enable = true;
  services.flatpak.enable = true;

  virtualisation.docker.enable = true;
  virtualisation.podman.enable = true;
  virtualisation.libvirtd.enable = true;

  fonts.packages = with pkgs; [
    nerd-fonts._0xproto
    nerd-fonts.blex-mono
    nerd-fonts.caskaydia-mono
    nerd-fonts.comic-shanns-mono
    nerd-fonts.droid-sans-mono
    nerd-fonts.fira-code
    nerd-fonts.go-mono
    nerd-fonts.jetbrains-mono
    nerd-fonts.sauce-code-pro
    nerd-fonts.ubuntu
    source-code-pro
  ];

  users.users.austinstowe = {
    isNormalUser = true;
    shell = pkgs.zsh;
    extraGroups = [
      "wheel"
      "networkmanager"
      "dialout"
      "docker"
      "libvirtd"
    ];
  };

  home-manager = {
    useGlobalPkgs = true;
    useUserPackages = true;
    # Keep files from the installer's first login instead of failing the switch.
    backupFileExtension = "hm-backup";
    users.austinstowe = import ../../home;
  };

  nix.settings.experimental-features = [
    "nix-command"
    "flakes"
  ];

  # Set once to the release that was first installed; never change it to upgrade.
  system.stateVersion = "26.05";
}
