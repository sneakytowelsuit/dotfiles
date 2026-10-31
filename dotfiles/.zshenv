export ZDOTDIR="$HOME/.config/zsh"
# Use Aurora's shared agent, preserving an explicitly selected or forwarded one.
if [[ -z "${SSH_AUTH_SOCK:-}" && -n "${XDG_RUNTIME_DIR:-}" ]]; then
    export SSH_AUTH_SOCK="$XDG_RUNTIME_DIR/ssh-agent.socket"
fi
# mise's native Brew installer uses the standard prefix without requiring brew.
typeset -U path
path=("$HOME/.local/bin" /usr/local/bin /home/linuxbrew/.linuxbrew/bin /home/linuxbrew/.linuxbrew/sbin $path)
# Select the image's mise even when an older copy remains in Homebrew.
if [[ -x /usr/libexec/workstation/mise ]]; then
    path=(/usr/libexec/workstation $path)
fi
