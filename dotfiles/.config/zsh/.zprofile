# Login sessions give editors shims; interactive sessions activate mise in .zshrc.
(( $+commands[mise] )) && eval "$(mise activate zsh --shims)"
