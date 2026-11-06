{ config, pkgs, ... }:

let
  # Link into the checkout, as on Aurora: edits apply without a rebuild, and
  # applications that write their config (Neovim, Noctalia) keep working.
  dotfiles = "${config.home.homeDirectory}/Development/dotfiles/nixos/home/dotfiles";
  link = path: config.lib.file.mkOutOfStoreSymlink "${dotfiles}/${path}";
in
{
  home.username = "austinstowe";
  home.homeDirectory = "/home/austinstowe";

  home.packages = with pkgs; [
    # Shell
    atuin
    bash-preexec
    bat
    direnv
    eza
    fd
    fzf
    jq
    ripgrep
    starship
    tealdeer
    trash-cli
    ugrep
    uutils-coreutils-noprefix
    yq-go
    zoxide

    # Development
    bitwarden-cli
    cdk8s-cli
    chezmoi
    cosign
    devcontainer
    dysk
    gh
    k9s
    kind
    kubectl
    lazygit
    mise
    neovim
    podman-tui
    yazi

    # Neovim plugins build parsers and unpack tools with these.
    gcc
    gnumake
    unzip

    # AI
    llm
    llmfit
    ollama
    ramalama

    # Herdr
    herdr
    herdr-core

    # Desktop
    foot
    fuzzel
    ghostty
    noctalia
    swaylock
    wl-clipboard
  ];

  # Same socket path as Aurora, which the tracked SSH config and environment.d use.
  services.ssh-agent = {
    enable = true;
    socket = "ssh-agent.socket";
  };

  home.file = {
    ".gitconfig".source = link ".gitconfig";
    ".zshenv".source = link ".zshenv";
    ".ssh/config".source = link ".ssh/config";
  };

  xdg.configFile = {
    "foot".source = link ".config/foot";
    "ghostty".source = link ".config/ghostty";
    "mise".source = link ".config/mise";
    "niri".source = link ".config/niri";
    "noctalia".source = link ".config/noctalia";
    "nvim".source = link ".config/nvim";

    # Linked one by one because Nix also generates a file in these directories.
    "environment.d/60-ssh-agent.conf".source = link ".config/environment.d/60-ssh-agent.conf";
    "zsh/.zshenv".source = link ".config/zsh/.zshenv";
    "zsh/.zprofile".source = link ".config/zsh/.zprofile";
    "zsh/.zshrc".source = link ".config/zsh/.zshrc";
    "zsh/plugins.zsh".source = link ".config/zsh/plugins.zsh";
    "zsh/nix-paths.zsh".text = ''
      zinit_path=${pkgs.zinit}/share/zinit/zinit.zsh
    '';
  };

  # Set once to the release that was first installed; never change it to upgrade.
  home.stateVersion = "26.05";
}
