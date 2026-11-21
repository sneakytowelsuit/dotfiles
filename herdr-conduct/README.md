# Conduct: a Herdr layout for running many agents from a primary one

A copy of `herdr-watch` reworked for the "one primary agent, dozens of sub-agents" workflow. Sub-agents are terminals the primary started with `hc run` (herdr-core records the parent), which Herdr's own `agents()` omits, so this layout reads `terminals()` instead.

- **Top bar:** a chip per state with its count: `BLOCKED`, `ERROR`, `STUCK?`, `REVIEW` (outlined when empty, filled with a pulsing halo when something is waiting), `WORKING`, `IDLE`. Then the top 3 agents that need you and `+n more`. Press and hold a chip for a menu of those agents; click it to cycle through them. `⚑ NUDGE` (haloed when something needs attention) at the right.
- **Sidebar:**
  - `NEEDS YOU`: every blocked, errored, stuck or finished-unread agent as a full row: its message or activity, `NEW` until you've opened it, how long it has been in that state, and `REPLY` / `NUDGE` / `OPEN`.
  - `PRIMARY AGENTS`: a card per agent that has sub-agents, with counts per state, a `NUDGE` button, working sub-agents as one-liners with their activity (`Thingamajigging… 12s · ↓ 1.2k tokens`), and idle ones folded into `▸ n idle`.
  - `OTHER AGENTS` and `SPACES`.
- **STUCK?** An agent that reports `working` but whose screen (ignoring the ticking clock) hasn't changed for 3 minutes. Override with the shared value `conduct.stall_ms` or `STALL_MS` in `attn.js`.
- **Reply** (`REPLY`/`NUDGE` on a row): quick answers (yes / no / continue; or a status check), `Interrupt`, and a free-text line, typed into that agent's terminal. It uses `hc send --force`, so it types into a blocked agent: that is your decision, made by clicking.
- **Nudge** (`⚑ NUDGE`, `alt-m`, or a primary's card): composes a Herdr-specific message: the IDs are Herdr terminal addresses, not harness session names, so it names the `hc` commands to use (`hc ls`, `hc read <id>`, `hc send <id> "<text>"`, `hc interrupt <id>`), lists each flagged sub-agent (`- t1z "worker-1": blocked (question)`), and tells the primary to ask you before answering a permission or question. Editable in a multi-line box; Ctrl+Enter or `Send nudge` sends it.
- **Triage inbox** (`INBOX n` in the bar, or `alt-t`; toggles): only the critical unread (blocked, error, stuck), one card at a time with the tail of its screen. `→`/`r` mark read, `←`/`u` leave unread and move on, `i`/Enter reply inline (Enter sends and marks read, Esc backs out), `1`-`4` quick replies (blocked: yes / no / continue / skip), `g` (or `o`) go to the agent, `n` nudge its primary, `d` also include finished (REVIEW), `Esc`/`q`/`t` close. "Read" is the same mark behind the sidebar's `NEW` tag, and an agent that changes state becomes unread again.
- **Question forms:** a Claude `AskUserQuestion` in the inbox is drawn as a form in the app font instead of the terminal menu: radio rows (single) or checkboxes (multi) with descriptions, a tab strip for multi-question forms, `Something else…` for a typed answer, then a review step with `Submit answers`. Click an option or press its number; `Enter` continues or submits, `b` goes back, `v` shows the raw screen. It works by reading the question off the agent's screen and pressing the keys the terminal menu expects (`hc keys`), so it depends on Claude Code's current menu layout. `REPLY` on a question opens the inbox on that agent.
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

`test/haiku-question.sh [n]` starts real Haiku agents that stop on a blocking question (a few cents each), for testing the real blocked -> reply -> review path.

Limits: how long an agent has been in a state is counted from when this layout first saw it (core's `status_ms` isn't exposed for sub-agents). The activity line is parsed from Claude Code's screen only.

## Triage details

- **Every hotkey hint is a button**, including the quick replies; `GO TO AGENT` is also in the card header. `g` marks it read and drops you into its terminal (its pane, or a peek over its tab for a sub-agent).
- **Leaving questions unanswered:** in a question form, a single-select click only *stages* the pick (click it again to clear, `Reset` too); `Confirm`/`Enter` sends it, a digit key sends at once. `Skip this question →` (`s`) moves on without answering, and the review step says which are unanswered, so the agent asks about them next. A multi-select toggles on click, and `Reset` unticks everything. Claude's own menu can't clear an answer already sent, so the form says so.
- **One agent at a time, all its questions, then the next:** the header says `Agent 2 of 5`; a question form says `QUESTION 2 OF 3` over clickable chips (one per question, plus `Review`) that jump straight to that question. Agents under the same primary are kept together. `r` or `u` on an agent with an open form asks "Leave anyway?" first (press it again, or click `Mark read` / `Stay`). Submitting the review (`Submit and go to next agent`), or answering a single-question form, sends the answers, shows "✓ Sent 3 answers to worker-3 → next: worker-4" and moves on by itself.
- **Read means "this state"**, not "this agent": the mark records the state and when it began, so an agent that is answered, goes back to work, and blocks again later is unread again.
