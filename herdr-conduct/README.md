# Conduct: a Herdr layout for running many agents from a primary one

A copy of `herdr-watch` reworked for the "one primary agent, dozens of sub-agents" workflow. Sub-agents are terminals the primary started with `hc run` (herdr-core records the parent), which Herdr's own `agents()` omits, so this layout reads `terminals()` instead.

- **Top bar:** a chip per state with its count: `BLOCKED`, `ERROR`, `STUCK?`, `REVIEW` (outlined when empty, filled with a pulsing halo when something is waiting), `WORKING`, `IDLE`. Then the top 3 agents that need you and `+n more`. Press and hold a chip for a menu of those agents; click it to cycle through them. `⚑ NUDGE` (haloed when something needs attention) at the right.
- **Sidebar:**
  - `NEEDS YOU`: every blocked, errored, stuck or finished-unread agent as a full row: its message or activity, `NEW` until you've opened it, how long it has been in that state, and `REPLY` / `NUDGE` / `OPEN`.
  - `PRIMARY AGENTS`: a card per agent that has sub-agents, with counts per state, a `NUDGE` button, working sub-agents as one-liners with their activity (`Thingamajigging… 12s · ↓ 1.2k tokens`), and idle ones folded into `▸ n idle`.
  - `OTHER AGENTS` and `SPACES`.
- **STUCK?** An agent that reports `working` but whose screen (ignoring the ticking clock) hasn't changed for 3 minutes. Override with the shared value `conduct.stall_ms` or `STALL_MS` in `attn.js`.
- **Reply** (`REPLY`/`NUDGE` on a row): quick answers (yes / no / continue; or a status check), `Interrupt`, and a free-text line, typed into that agent's terminal. It uses `hc send --force`, so it types into a blocked agent: that is your decision, made by clicking.
- **Nudge** (`⚑ NUDGE`, `alt-m`, or a primary's card): composes "Please check on your sub-agents. worker-1 (t1z) is blocked; worker-5 (t23) looks stuck (no change for 4m)…", editable, sent to the primary on confirm.
- **Go:** clicking anything switches space and tab and focuses the pane (a sub-agent has no pane, so it is peeked). `alt-n` / `alt-p` step through what needs you.

## Install

```sh
H=~/.config/herdr-app
cp layouts/conduct.json "$H/layouts/" && cp -r mods/conduct-* "$H/mods/"
# merge keys.json's "layout:conduct" section into $H/keys.json
herdr-app do layout.switch --name conduct
```

The mods share `attn.js` (the model and helpers); edit the copy in `mods/conduct-bar/` and run `./sync-shared.sh`.

## Testing without spending tokens

`test/scenario.sh up [n]` starts `n` fake agents (`test/fake-agent.sh`) as sub-agents of the terminal it runs in, reporting every state over OSC 7501 with a Claude-like activity line; `down` removes them. They echo whatever they're sent. Run it from a terminal inside Herdr so that terminal becomes the primary. Herdr-core will type its automatic notes about them into that terminal.

Limits: how long an agent has been in a state is counted from when this layout first saw it (core's `status_ms` isn't exposed for sub-agents). The activity line is parsed from Claude Code's screen only.
