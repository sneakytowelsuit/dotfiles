export ZDOTDIR="$HOME/.config/zsh"
# Use the shared agent from Home Manager, preserving an explicitly selected or forwarded one.
if [[ -z "${SSH_AUTH_SOCK:-}" && -n "${XDG_RUNTIME_DIR:-}" ]]; then
    export SSH_AUTH_SOCK="$XDG_RUNTIME_DIR/ssh-agent.socket"
fi
typeset -U path
path=("$HOME/.local/bin" $path)
# herdr-core can start with NO_COLOR set, which turns off color in its terminals.
unset NO_COLOR
