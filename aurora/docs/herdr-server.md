# Herdr server

The laptop connects to a Debian 13 VM on the Proxmox host `hephaestus`.

| Setting | Value |
| --- | --- |
| Proxmox host | `root@192.168.53.100` |
| VM | `100`, named `herdr`, starts automatically with Proxmox |
| Resources | 4 vCPUs, 16 GiB RAM, 128 GiB disk on `tank` |
| Guest address | `192.168.53.95` (DHCP) |
| Guest MAC | `BC:24:11:49:75:11` |
| SSH alias / Herdr machine | `herdr-server` |
| Guest account | `austinstowe`, with sudo access |
| Projects | `/home/austinstowe/src` |

Reserve `192.168.53.95` for the guest MAC in the router's DHCP settings. If its address changes before a reservation is in place, get the new address from Proxmox with `qm guest cmd 100 network-get-interfaces`, update `HostName` in `dotfiles/.ssh/config`, and verify the guest host key before updating `known_hosts`.

Bootstrap deploys the SSH alias. The laptop's private key stays on the laptop; the VM has only its public key. SSH passwords, keyboard-interactive authentication, and root SSH login are disabled in the guest. SSH agent forwarding is disabled for this alias. The guest's SSH host public key was retrieved through Proxmox's authenticated QEMU guest-agent channel before it was trusted on the laptop.

After a laptop reboot, unlock the laptop key with `ssh-add ~/.ssh/id_ed25519`. Check connectivity:

```sh
ssh herdr-server
hc machine ls
hc exec --on herdr-server --cwd /home/austinstowe/src hostname
```

Herdr core is installed in the guest at `~/.local/bin/herdr-core`, with the `hc` symlink. A fresh laptop also needs its public key authorized in the guest and the connection registered:

```sh
hc machine add herdr-server --name herdr-server --install
```

That command can deploy a compatible core when needed. It does not install the desktop app or coding agents on the server. Install and authenticate the coding tools you want inside the VM; their credentials and project files stay there. Closing the laptop's Herdr window leaves remote programs running. Rebooting the VM or host stops them; saved panes recover as new shells rather than automatically restarting agents. See [Herdr remote machines](https://github.com/herdrdev/herdr-core/blob/master/docs/machines.md).

The VM's initial cloud-init configuration is stored on Proxmox at `/var/lib/vz/snippets/herdr-100-user.yaml`. It installs QEMU guest agent, Git, build tools, and unattended security updates, and enables user lingering. Future guest maintenance uses normal Debian tools, for example `sudo apt update && sudo apt upgrade`. Update the remote core from the laptop with `hc machine update herdr-server`.
