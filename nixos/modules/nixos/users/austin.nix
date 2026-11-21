# The `austin` account and its Home Manager configuration.
# Import this from any host that austin should be able to log into.
{ inputs, pkgs, ... }:

{
  imports = [ inputs.home-manager.nixosModules.home-manager ];

  users.users.austin = {
    isNormalUser = true;
    description = "Austin";
    extraGroups = [
      "input" # mouseless reads keyboards via evdev
      "networkmanager"
      "uinput" # ...and emits events through /dev/uinput
      "wheel"
    ];
    shell = pkgs.zsh;
    # Keep the user's systemd services running after logout, so herdr-core's
    # terminals and agents survive it (herdr-core would otherwise enable this
    # itself, outside Nix).
    linger = true;
  };

  hardware.uinput.enable = true;

  # Needed for a login shell: registers zsh in /etc/shells and sets up
  # system-wide completion. The interactive config is in modules/home/zsh.nix.
  programs.zsh.enable = true;
  # Lets zsh find completions for system-installed packages.
  environment.pathsToLink = [ "/share/zsh" ];

  home-manager = {
    useGlobalPkgs = true; # use the system's nixpkgs (and allowUnfree)
    useUserPackages = true; # install into /etc/profiles instead of ~/.nix-profile
    extraSpecialArgs = { inherit inputs; };
    # Move pre-existing files aside instead of failing activation.
    backupFileExtension = "backup";
    users.austin = import ../../home;
  };
}
