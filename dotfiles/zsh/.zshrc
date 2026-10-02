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
bindkey '^P' up-line-or-history
bindkey '^N' down-line-or-history

# Fix history navigation in Normal/Command Mode (vicmd)
bindkey -M vicmd '^P' up-line-or-history
bindkey -M vicmd '^N' down-line-or-history
#####

##### aliases
alias gg='lazygit'
autoload -U compinit
compinit

#allow tab completion in the middle of a word
setopt COMPLETE_IN_WORD

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
