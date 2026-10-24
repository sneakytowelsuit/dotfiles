# Completion functions must be on fpath before compinit.
if (( $+functions[zinit] )); then
    zinit light zsh-users/zsh-completions
fi
autoload -Uz compinit
compinit

# fzf-tab must wrap completion before widget wrappers below it.
if (( $+functions[zinit] )); then
    zinit light Aloxaf/fzf-tab
    zinit light zsh-users/zsh-autosuggestions
    zinit light zdharma-continuum/fast-syntax-highlighting
    zinit cdreplay -q
fi
