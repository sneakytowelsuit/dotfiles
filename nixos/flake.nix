{
  description = "NixOS configurations for my machines";

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

    # Doom Emacs and its packages built by Nix.
    nix-doom-emacs-unstraightened = {
      url = "github:marienz/nix-doom-emacs-unstraightened";
      # Its nixpkgs input is only for its own CI; the module uses ours.
      inputs.nixpkgs.follows = "";
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
    { nixpkgs, ... }@inputs:
    let
      # One line per machine: hosts/<name>/default.nix holds everything
      # specific to it; the hostname comes from the attribute name.
      mkHost =
        hostName:
        nixpkgs.lib.nixosSystem {
          # Makes `inputs` available as a module argument (needed for use in `imports`).
          specialArgs = { inherit inputs; };
          modules = [
            ./hosts/${hostName}
            { networking.hostName = hostName; }
          ];
        };
    in
    {
      nixosConfigurations = {
        framework = mkHost "framework";
      };

      # `nix fmt` formats every .nix file in the repo.
      formatter.x86_64-linux = nixpkgs.legacyPackages.x86_64-linux.nixfmt-tree;
    };
}
