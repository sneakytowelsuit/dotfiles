# Everyday command-line tools: the ones scripts, agents and one-off debugging
# reach for, so they are always on PATH instead of needing `nix shell` first.
# Language toolchains (node, gcc, make, ...) are deliberately not here: those
# belong in per-project devShells (see HANDOFF.md).
#
# bash itself is already installed system-wide by NixOS (nothing to add);
# curl, git, gh, rg, rsync, perl, tar and the other basics are covered too.
{ pkgs, ... }:

{
  home.packages = with pkgs; [
    # Data wrangling
    jq # JSON on the command line
    yq-go # the same for YAML, TOML and XML
    sqlite # sqlite3 shell: inspect app databases
    bc # calculator for shell arithmetic
    bat

    # Scripting
    # Herdr's Claude Code hook (~/.claude/hooks/herdr-agent-state.sh) is a python3
    # script that silently does nothing when python3 is missing.
    python3
    shellcheck # lint shell scripts
    shfmt # format them

    # Files and archives
    file # what is this file?
    tree # directory trees
    fd # find, but friendlier
    unzip
    zip
    wget

    # Images: render and resize SVGs and screenshots (e.g. the Herdr layout's sprites)
    imagemagick # convert, magick
    librsvg # rsvg-convert

    # System and network
    htop
    lsof # who has this file or port open
    psmisc # killall, fuser, pstree
    dnsutils # dig, nslookup
  ];
}
