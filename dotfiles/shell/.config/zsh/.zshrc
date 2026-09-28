bindkey -v

if (( $+commands[brew] )); then
    zinit_path="$(brew --prefix zinit 2>/dev/null)/zinit.zsh"
    [[ -f "$zinit_path" ]] && source "$zinit_path"
fi

source "$ZDOTDIR/plugins.zsh"

(( $+commands[starship] )) && eval "$(starship init zsh)"
(( $+commands[zoxide] )) && eval "$(zoxide init zsh)"
(( $+commands[atuin] )) && eval "$(atuin init zsh)"
(( $+commands[mise] )) && eval "$(mise activate zsh)"
