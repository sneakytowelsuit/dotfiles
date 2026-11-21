# Integration notes: feed + alerts

## (a) What was built

**Activity feed** (`mods/conduct-feed`, dialog 0.62 x 0.86). "While you were away": a timeline of agent state changes grouped by day (TODAY, YESTERDAY, "Nov 3"). Each row: HH:MM, a state dot (a quiet 1px outline in the state colour; only blocked/error/stuck are filled), the sentence ("worker-7 is blocked: waiting: question") with the primary it belongs to underneath, and a state tag at the right. Click a row = `go()` to the agent (closes the dialog; an ended agent toasts "That agent has ended"). A line "SINCE YOU LAST LOOKED" in the accent colour sits at the previous `conduct.feed.seen`; the header shows an accent "n new" pill (or "nothing new") and a "Mark all seen" button. Filter chips by state (BLOCKED, ERROR, STUCK?, REVIEW, WORKING, IDLE, NEW, ENDED, UNSTUCK; critical ones use their colour when on) and, when there is more than one, by primary. Empty state text when nothing was recorded. Opening it writes `conduct.feed.seen = now`; the previous value is kept in memory for the divider. Esc closes. Refreshes every 4 s while open.

**Recording** (`feed.js`, pure; `observe.js`, herdr glue). `diffEvents(prev, nodes, now)` emits: new agent, entered blocked/error/stuck/done/working/idle, ended, unstuck. Noise rules: working<->idle within 5 s of entering the previous state is dropped; a primary's own done/idle/working churn is dropped (its blocked/error/stuck, appearing and ending are kept); one event per agent per diff; `append` also drops a repeat of the same agent+state within 60 s and caps at 400. Stored in shared `conduct.feed` (newest first). The first poll after start only takes a baseline (no events). `unreadCount(feed, seen)` (exported from feed.js and from conduct-feed/main.js) counts notable events (blocked, error, stuck, done, ended, unstuck) newer than `seen`.

**Alerts** (`alerts.js` pure, `observe.js` fire, `mods/conduct-alerts` dialog 0.5 x 0.7). An alert fires for an agent that NEWLY becomes blocked/error/stuck, unless it is focused or a primary; one per agent per 2 minutes; 3 or more in one poll become one "N agents need you" alert listing up to three titles; a watched agent (shared `conduct.watch`, addresses) that becomes `done` alerts once ("x finished", sound "done") and is removed from the set. Master switch, quiet hours (24 h HH:MM, may cross midnight, suppress everything; a watched agent that finishes during quiet hours is not announced later but stays watched), per-channel switches. Channels: toast via `notify()` (click opens `conduct-triage`), `playSound("blocked"|"done")` (default OFF because Herdr plays its own attention sounds; turn on only if those are silenced), ntfy push (default OFF) sent with `exec("curl", ["-sS","-m","5","--fail","-d", <json>, "https://ntfy.sh"])` as a JSON publish. Settings are the shared value `conduct.alerts` = `{enabled, quiet:{on,from,to}, toast, sound, push:{on,topic}}`. The dialog has hand-drawn switches (quiet accent, no loud colours), validated time fields, a push box with a red-bordered explanation when on, a Generate button (random `conduct-` + 20 chars), a topic validator (8-64 of A-Za-z0-9_-) and a "Send test notification" button (fixed text, no agent data; uses `this.cx` after the await).

Hotkeys (new `keys.js` ACTIONS, defaults in (b)): `ctrl-alt-f` feed, `ctrl-alt-a` alert settings.

## (b) Integrator edits

1. **sync-shared.sh**: the source of truth for the new files is `mods/conduct-feed/` (this track keeps copies of `attn.js` there and in `conduct-alerts/`). Add:
```sh
for m in conduct-feed conduct-alerts; do mkdir -p "$m"; cp conduct-bar/attn.js "$m/"; done   # or add both to the existing attn list
for m in conduct-queue conduct-bar; do cp conduct-feed/feed.js "$m/"; done                 # bar: unreadCount
for m in conduct-queue conduct-alerts; do cp conduct-feed/alerts.js "$m/"; done              # queue: rules, alerts mod: settings
cp conduct-feed/observe.js conduct-queue/
```
(conduct-feed already holds feed.js, alerts.js, observe.js, attn.js. conduct-alerts holds alerts.js, attn.js.) `attn.js` is not changed by this track.

2. **conduct-queue/main.js** poll(): add `import { observe } from "./observe.js";` and, right after `const m = model(); const now = Date.now();`:
```js
observe(m.nodes, now); // feed + alerts; same snapshot the poller builds, never throws
```
Better after the `conduct.since` update (so `since` is set on nodes for the flicker rule you may want `m.list.forEach(n => n.since ??= since[n.address]?.t ?? null)` before the call; without it the 5 s flicker rule simply does not apply, nothing breaks). Do NOT call `model()` a second time.

3. **conduct-bar/main.js**: next to the INBOX pill add a feed button: `import { unreadCount } from "./feed.js";` then
```js
const unread = unreadCount(shared("conduct.feed") ?? [], Number(shared("conduct.feed.seen")) || 0);
// quiet outline pill, same style as NUDGE; label unread ? `FEED ${unread}` : "FEED"; accent border when unread > 0 (never filled/haloed)
.on_click(() => run("mod.open", { name: "conduct-feed" }))
```
tooltip: "What happened while you were away" plus the hotkey `first("g.feed")`. Re-renders on shared changes already.

4. **keys.js** ACTIONS (after `g.settings`), then sync:
```js
{ id: "g.feed", scope: "global", label: "Open the activity feed", command: "mod.open:conduct-feed", def: ["ctrl-alt-f"] },
{ id: "g.alerts", scope: "global", label: "Open alert settings", command: "mod.open:conduct-alerts", def: ["ctrl-alt-a"] },
```
(`hc keys`-style limits do not apply to these.) If the preset buttons rewrite `alt-` prefixes, `ctrl-alt-f` is left as is: use `def: ["alt-f"]` / `["alt-a"]` if you want presets to move them.

5. **conduct-settings/main.js**: a link in the Hotkeys tab header row or a new small section: a `btn(t, "s-alerts", "Alert settings…", false, () => run("mod.open", { name: "conduct-alerts" }))` and one for `conduct-feed`.

6. **Watch set**: the snooze/attention track writes `conduct.watch` (array of addresses); `alerts.js` exports `toggleWatch(watch, address)` and `unwatch(watch, addrs)` if useful (copy alerts.js there).

7. **README, "What it touches"**:
> Alerts (Settings, `ctrl-alt-a`) are local by default. If you turn on phone/desktop push, each alert sends the agent's title and its one-line message to ntfy.sh, a third-party server, over HTTPS using `curl`; the topic you choose is the only secret (anyone who knows it can read and send), so use the generated random one. It is off by default and nothing is sent while it is off. The activity feed stores agent titles and short status messages (never conversation text) in Herdr's shared state, newest 400 events.

## (c) Not verified
Only `herdr-app check` and node tests were run (`node test/feed/feed.test.mjs`); no live window. Not exercised: the `notify` action shape `{name:"mod.open", args:{name:"conduct-triage"}}` (from AGENTS.md: action name + args), real curl to ntfy.sh, `Input` focus behaviour in the alerts dialog, row layout at narrow widths.

## (d) Check in the live window
- Feed dialog: divider position, "n new" pill, click-to-go from a row for a sub-agent (peek), filters, scrolling with ~400 rows.
- First poll after startup records nothing; then a fake agent (`test/scenario.sh up`) blocking shows one toast and one feed line; 5 at once gives one "5 agents need you".
- Herdr also posts its own toast and sound when an agent needs you; decide whether alerts' toast duplicates it (consider default toast off if so).
- ntfy: test button with a real topic; with curl missing the dialog shows the error.
- Event `since` is not on the node until the poller sets it (see edit 2).
