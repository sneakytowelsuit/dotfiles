# Framework Laptop 13 Pro (Intel Core Ultra Series 3).
# Only what is specific to this machine lives here; shared setup comes from
# ../../modules.
{ inputs, ... }:

{
  imports = [
    ./hardware-configuration.nix
    inputs.nixos-hardware.nixosModules.framework-intel-core-ultra-series3

    ../../modules/nixos/base.nix
    ../../modules/nixos/desktop.nix
    ../../modules/nixos/yubikey.nix
    ../../modules/nixos/users/austin.nix
  ];

  boot.loader.systemd-boot = {
    enable = true;
    # Keep /boot (1 GiB) from filling up with old generations.
    configurationLimit = 10;
  };
  boot.loader.efi.canTouchEfiVariables = true;

  hardware.cpu.intel.npu.enable = true;

  # Fingerprint reader: adds itself to sudo, polkit and login after the YubiKey.
  services.fprintd.enable = true;

  # The releases this machine was first installed with. They are NOT the
  # versions you run and must not be bumped on upgrades: they keep stateful
  # defaults (databases, file layouts) compatible with existing data.
  # A new machine gets whatever release it is installed with.
  system.stateVersion = "26.05";
  home-manager.users.austin.home.stateVersion = "26.05";
}
