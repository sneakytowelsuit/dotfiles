export ZDOTDIR="$HOME/.config/zsh"
# mise's native Brew installer uses the standard prefix without requiring brew.
typeset -U path
path=("$HOME/.local/bin" /usr/local/bin /home/linuxbrew/.linuxbrew/bin /home/linuxbrew/.linuxbrew/sbin $path)
