{
  description = "SneakyTowelSuit - Framework 16 Personal Config";

  inputs = {
    nixpkgsstable.url = "github:nixos/nixpkgs?ref=nixos-24.11";
  };

  outputs = { nixpkgsstable, ... } @ inputs:
  let
    system = "x86_64-linux";
    nixpkgs = nixpkgsstable.legacyPackages.${system};
    hostname = "nixos";
  in {
    nixosConfigurations.${hostname} = nixpkgs.lib.nixosSystem {
      specialArgs = {
        inherit hostname;
        inherit inputs;
      };
      modules = [ ./modules/configuration.nix ];
    };
  };
}
