# PLACEHOLDER: lets the flake evaluate before NixOS is installed. It will not
# boot a real machine. Replace it during install with the generated file; see
# nixos/README.md.
{ ... }:

{
  boot.initrd.availableKernelModules = [
    "xhci_pci"
    "thunderbolt"
    "nvme"
    "usb_storage"
    "sd_mod"
  ];
  boot.kernelModules = [ "kvm-intel" ];

  fileSystems."/" = {
    device = "/dev/disk/by-label/REPLACE-ME-root";
    fsType = "ext4";
  };
  fileSystems."/boot" = {
    device = "/dev/disk/by-label/REPLACE-ME-boot";
    fsType = "vfat";
  };
}
