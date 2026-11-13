{
  description = "Framework 13 Pro System Flake";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";

    nixos-hardware = {
      url = "github:NixOS/nixos-hardware";
      inputs.nixpkgs.follows = "nixpkgs";
    };

    home-manager = {
      url = "github:nix-community/home-manager/master";
      inputs.nixpkgs.follows = "nixpkgs";
    };

    zen-browser = {
      url = "github:0xc000022070/zen-browser-flake";
      inputs = {
        nixpkgs.follows = "nixpkgs";
        home-manager.follows = "home-manager";
      };
    };
  };

  outputs =
    {
      nixpkgs,
      nixos-hardware,
      home-manager,
      ...
    }@inputs:
    {
      nixosConfigurations.framework = nixpkgs.lib.nixosSystem {
        # Makes `inputs` available as a module argument (needed for use in `imports`).
        specialArgs = { inherit inputs; };
        modules = [
          ./configuration.nix
          nixos-hardware.nixosModules.framework-intel-core-ultra-series3
          home-manager.nixosModules.home-manager
          {
            home-manager.useGlobalPkgs = true;
            home-manager.useUserPackages = true;
            home-manager.extraSpecialArgs = { inherit inputs; };
            # Move pre-existing files (e.g. VS Code settings.json) aside instead of failing
            home-manager.backupFileExtension = "backup";
            home-manager.users.austin = import ./home.nix;
          }
        ];
      };

      # `nix fmt` formats every .nix file in the repo.
      formatter.x86_64-linux = nixpkgs.legacyPackages.x86_64-linux.nixfmt-tree;
    };
}
