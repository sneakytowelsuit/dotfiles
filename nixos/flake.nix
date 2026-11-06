{
  description = "Framework Laptop 13 Pro NixOS workstation";

  inputs = {
    # This laptop's hardware is new and Herdr/Noctalia move quickly; track unstable.
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    nixos-hardware.url = "github:NixOS/nixos-hardware/master";
    home-manager = {
      url = "github:nix-community/home-manager";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    {
      nixpkgs,
      nixos-hardware,
      home-manager,
      ...
    }:
    {
      nixosConfigurations.framework = nixpkgs.lib.nixosSystem {
        modules = [
          { nixpkgs.hostPlatform = "x86_64-linux"; }
          nixos-hardware.nixosModules.framework-intel-core-ultra-series3
          home-manager.nixosModules.home-manager
          ./hosts/framework/configuration.nix
          ./hosts/framework/hardware-configuration.nix
        ];
      };
    };
}
