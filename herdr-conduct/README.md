# Conduct: a Herdr layout for supervising many agents

Built for a primary agent driving several others: one glance tells you who needs you, one click or key takes you there.

- **Top bar monitor.** Chips `BLOCKED`, `REVIEW` (done, unseen), `WORKING`, `IDLE`, each with a count. Chips that need you (blocked, review) are filled and wrapped in a pulsing halo once their count is above zero; the rest are outlines. Beside them, a filled haloed chip per agent that needs you (up to 5, `+n` beyond). The bar's bottom border turns red while anything is blocked.
- **Sidebar queue.** Agents grouped `NEEDS YOU` / `WORKING` / `IDLE`. Needs-you rows are tinted, haloed, with a pulsing stripe. Sub-agents show `↳ parent`. Spaces sit below with a pulsing dot when one contains something that needs you.
- **Pane headers.** A status stripe across the top and a status tag; blocked and done panes get a tinted header and a filled, pulsing tag.
- **Navigation.** Click any chip or row to jump to the space, tab and pane. Clicking a count chip cycles through agents in that state; press and hold (about half a second) opens a menu of them to pick from. `alt-n` / `alt-p` jump to the next / previous agent that needs you.

## Install

```sh
H=~/.config/herdr-app
cp layouts/conduct.json "$H/layouts/" && cp -r mods/conduct-* "$H/mods/"
# merge keys.json's "layout:conduct" section into $H/keys.json
herdr-app do layout.switch --name conduct
```

The three mods share `attn.js`; edit the copy in `mods/conduct-bar/` and run `./sync-shared.sh`. Not managed by Nix.
