# Framework 13 Pro workstation

This repository holds two independent configurations for the same laptop. Use the one for the OS you are running; neither reads, builds, or deploys the other.

| Directory | OS | Apply with | Guide |
| --- | --- | --- | --- |
| `aurora/` | Aurora DX with a custom bootc image | `ujust workstation-sync` | [aurora/README.md](aurora/README.md) |
| `nixos/` | NixOS with a flake and Home Manager | `sudo nixos-rebuild switch --flake ./nixos#framework` | [nixos/README.md](nixos/README.md) |

Nothing keeps the two in sync. A change made in one directory has to be copied to the other by hand if you want it there.

GitHub requires workflows in `.github/workflows/`. Each one only runs for its own OS's paths.
