{
  description = "SneakyTowelSuit - Framework 16 Personal Config";

  inputs = {
    nixpkgsStable.url = "github:nixos/nixpkgs?ref=nixos-24.11";
  };

  outputs = { nixpkgsStable, ... } @ inputs:
  let
    hostname = "nixos";
  in {
    nixosConfigurations."${hostname}" = nixpkgsStable.lib.nixosSystem {
      specialArgs = {
        inherit hostname;
        inherit inputs;
      };
      modules = [ ./modules/configuration.nix ];
    };
  };
}
