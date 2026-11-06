#
# .zshrc is sourced in interactive shells.
# It should contain commands to set up aliases,
# functions, options, key bindings, etc.
#
##### VIM-like settings
bindkey -v
# Reduce delay when switching from Insert to Normal mode
export KEYTIMEOUT=1
bindkey '^R' history-incremental-search-backward
bindkey '^S' history-incremental-search-forward
export EDITOR=nvim
autoload -Uz edit-command-line
zle -N edit-command-line
bindkey -M vicmd 'v' edit-command-line
# Fix history navigation in Insert Mode
bindkey '^P' up-history
bindkey '^N' down-history

# Fix history navigation in Normal/Command Mode (vicmd)
bindkey -M vicmd '^P' up-line-or-history
bindkey -M vicmd '^N' down-line-or-history
#####

##### aliases
alias gg='lazygit'
#allow tab completion in the middle of a word
setopt COMPLETE_IN_WORD

zinit_path=/home/linuxbrew/.linuxbrew/opt/zinit/zinit.zsh
[[ -f "$zinit_path" ]] && source "$zinit_path"

# Initialize completion once, before loading the widget plugins.
source "$HOME/.config/zsh/plugins.zsh"

(( $+commands[starship] )) && eval "$(starship init zsh)"
(( $+commands[zoxide] )) && eval "$(zoxide init zsh --cmd cd)"
(( $+commands[atuin] )) && eval "$(atuin init zsh)"
(( $+commands[mise] )) && eval "$(mise activate zsh)"

## keep background processes at full speed
#setopt NOBGNICE
## restart running processes on exit
#setopt HUP

## history
#setopt APPEND_HISTORY
## for sharing history between zsh processes
#setopt INC_APPEND_HISTORY
#setopt SHARE_HISTORY

## never ever beep ever
#setopt NO_BEEP

## automatically decide when to page a list of completions
#LISTMAX=0

## disable mail checking
#MAILCHECK=0

# autoload -U colors
#colors
