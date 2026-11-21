# Track "attention": snooze, watch, recovery

New files only: `mods/conduct-snooze/{mod.json,main.js,snooze.js,attn.js}`, `mods/conduct-recover/{mod.json,main.js,recover.js,recover-actions.js,attn.js}`, `test/attention/attention.test.mjs`. `attn.js` in both is a copy of `conduct-bar/attn.js` (add them to sync-shared.sh, below). Tests: `node --test test/attention/attention.test.mjs` (13 pass, also under another TZ). `herdr-app check` passes for both mods.

## (a) What was built

**Snooze (`conduct-snooze`, dialog width 0.3, props `{address}`).** Header "Snooze" and Esc hint; the agent as an outlined state pill, its title and age; "Hide it until..." then five full-width buttons (5 min, 15 min, 1 hour, This afternoon (14:00, or +2 h once 14:00 has passed), Tomorrow 09:00), each showing its wake time ("14:10", "tomorrow 09:00"); a custom minutes box + Snooze (1 to 10080); a "Tell me when this finishes" toggle (shared `conduct.watch`, an array of addresses, consumed by the alerts track); "Un-snooze" (only shown while snoozed) and Close. State is `conduct.snooze = { address: { until, mark } }`, with `mark` = `"<status>@<since>"`, the same string `conduct.seen` uses. A snooze ends when `until` passes or the mark stops matching (the agent changed state). Pure logic in `snooze.js`: `markOf, snoozeFor, unsnooze, isSnoozed, due, wake, presets, untilText, minutesToUntil, setWatch, countSnoozed`. No colours beyond theme tokens; nothing filled except the accent primary button and the on-toggle.

**Recovery (`conduct-recover`, dialog 0.45 x 0.8, props `{address}`).** Pinned header; scrolling body: agent pill (filled only if blocked/error/stuck, via `colorOf`/`ink`), title, "what it says + age", address and space/tab; "END OF ITS SCREEN" (last 14 lines of `hc read`, refreshed every 4 s and after each action); ACTIONS rows with a one-line explanation each: Ask for a status (safe), Interrupt then ask, Restart, Restart and resume (only for a Claude Code argv without a resume flag; adds `--continue`), End it. The destructive three (Restart, Restart + resume, End it) have a red outlined button; the first click turns the row into a red "This ... LOST ..." warning with "Yes, do it" / "Cancel" (Esc also cancels). Restart wording says clearly that the agent LOSES its conversation unless its program resumes. A result box shows DONE / DID NOT WORK with text. Last block: AUTO-NUDGE toggle + minutes box + Save (`conduct.recover = {autoNudge:{on,minutes}}`, default off / 10). Restart reads `hc get <t> --json`; when the terminal's `argv` is just a shell (agents started from a shell) it restarts `foreground.argv` in `foreground.cwd` instead. It runs `hc kill`, waits (up to ~3 s) for the old terminal to go, then `hc run --bg [--name] [--cwd] (--parent P [--outlive-parent] | --no-parent) [--keep] [--no-notify] [--rm] argv...`; if the run fails the result prints the command to run by hand. The restarted agent is a NEW address.

`recover-actions.js` exports `statusCheck, interruptThenCheck, restart(address, resume), kill, sendStatusCheck, readTail, planRestart, autoNudgeTick(nodes, now), useClock(cx)`; each action returns `{ok,text}`. They wait with the AsyncContext given to `useClock(cx)` (falls back to `exec sleep`). `statusCheck` sends "Herdr status check: reply with ONE line..." with plain `hc send` (no --force: a blocked agent is refused and reported), waits 5 s, reads the screen tail.

**Auto-nudge.** Pure `shouldAutoNudge(node, config, now, state)`: true only when config on, `node.status === "stalled"` (never blocked/error/working/...), `now - (node.stuckSince ?? node.since) >= minutes`, and `state[address] !== stallMark(node)` (`"stalled@<since>"`, so once per stall). `autoNudgeTick` records into `conduct.autonudge` BEFORE sending, then `sendStatusCheck`.

## (b) Edits for the integrator

### attn.js `model()` (conduct-bar, then sync)
Add `import { isSnoozed, markOf } from` is NOT possible across folders, so inline it (it is two lines). After `n.since` and `n.unseen`/`n.fresh` are computed, in the `for (const n of nodes.values())` loop:

```js
const snz = (shared("conduct.snooze") ?? {})[n.address];
n.snoozed = Boolean(snz) && snz.until > Date.now() && snz.mark === `${n.status}@${n.since ?? ""}`;
n.snoozeUntil = n.snoozed ? snz.until : null;
n.unseen = needs(n) && !n.snoozed && seen[n.address] !== `${n.status}@${n.since ?? ""}`;
n.fresh = n.status === "done" && !n.snoozed && seen[n.address] !== `${n.status}@${n.since ?? ""}`;
n.watched = (shared("conduct.watch") ?? []).includes(n.address);
```
(replace the existing `n.unseen` / `n.fresh` lines). Note a snoozed agent still has `needs(n)` true, so the red top-bar chips keep counting it; to make snoozing quiet there too, in conduct-bar's chip counts use `list.filter(a => !a.snoozed)` for BLOCKED/ERROR/STUCK? and the red bottom border. Suggested: keep the chip count but exclude snoozed (they are accounted for by the SNOOZED chip).

Add helpers to attn.js for everyone: `export const awake = (list) => list.filter((a) => !a.snoozed);` and use `awake(...)` in `nextNeeding` and `sorted(list).filter(needs)` callers (inbox queue, bar INBOX count, queue NEEDS YOU).

### Inbox (conduct-triage)
- Queue filter: hide snoozed agents, i.e. wherever the inbox builds its queue from `needs`/CRITICAL nodes add `&& !a.snoozed`. A snoozed agent therefore leaves the queue immediately and returns on its own when the snooze ends (see queue poller).
- Hotkey actions in `act(name)` (before `case "close"`):
```js
case "snooze": if (n) { closeOverlay(props().overlay); openOverlay({ mod: "conduct-snooze", kind: "dialog", width: 0.3, props: { address: n.address } }); } return;
case "recover": if (n) { closeOverlay(props().overlay); openOverlay({ mod: "conduct-recover", kind: "dialog", width: 0.45, height: 0.8, props: { address: n.address } }); } return;
```
- Hint chips next to the others (line ~650): `this.hint(t, show("snooze"), "snooze", () => this.act("snooze"))` and `this.hint(t, show("recover"), "recover", () => this.act("recover"))`.
- Card buttons: SNOOZE and RECOVER small outlined buttons in the agent card's action row (same style as the NUDGE button: 20px high, 10px semibold, `t.muted` outline); RECOVER is shown only for stalled/error (and blocked agents are never auto-nudged, but may still be recovered by hand, so show it for all three needs states).
- "Snoozing before leave unread": when the inbox is closed/leaves an unfinished form (`this.leave` confirm step), add a third button "Snooze..." beside "Leave unread" / "Stay" (`this.act("snooze")`), so you can walk away from a half-done form without it nagging.

### keys.js ACTIONS (conduct-bar, then sync)
```js
{ id: "snooze", scope: "inbox", label: "Snooze this agent", def: ["z"] },
{ id: "recover", scope: "inbox", label: "Recover this agent (status, interrupt, restart)", def: ["x"] },
```
(Neither is among the existing defaults: r right u left i g o n d v b s enter escape q t.) In triage `key()` the generic `inboxAction()` already dispatches to `act(id)`.

### Queue (conduct-queue)
- In `poll()` after the `since` bookkeeping, wake due snoozes:
```js
import { wake } from "./snooze.js"; import { autoNudgeTick } from "./recover-actions.js"; // see sync below
const sz = shared("conduct.snooze");
if (sz && Object.keys(sz).length) {
  const w = wake(sz, m.nodes, now);
  if (w.changed) setShared("conduct.snooze", w.state);
  if (w.woken.length) { const seen = { ...(shared("conduct.seen") ?? {}) }; for (const a of w.woken) delete seen[a]; setShared("conduct.seen", seen); } // reappear unread
}
```
  (Time wakes only: a state change already makes the agent unread by itself.) Woken agents may also raise a notify/sound via the alerts track.
- Track when each stall began so auto-nudge counts from the stall, not from when working began: `const stuckSince = this.stuck ??= new Map();` after computing `stalled`, `for (const a of stalled) if (!stuckSince.has(a)) stuckSince.set(a, now); for (const a of [...stuckSince.keys()]) if (!stalled.includes(a)) stuckSince.delete(a);` Then at the end of poll: `await autoNudgeTick(new Map(m.list.map((n) => [n.address, { ...n, stuckSince: stuckSince.get(n.address) }])), now);` (it reads `conduct.recover` and `conduct.autonudge` itself; returns immediately when off). Queue needs copies of `snooze.js`, `recover.js`, `recover-actions.js` (recover-actions imports `./recover.js` and `herdr`); `useClock` is not needed there (falls back to `exec sleep`; or call `useClock(cx)` in `init`).
- Rows: hide snoozed agents from NEEDS YOU (`wants = list.filter(needs).filter(a => !a.snoozed)`); show them as a compact `line()` under their primary/others with a small clock text: `div().text_size(10).text_color(t.dim).child("⏱ snoozed until " + untilText(a.snoozeUntil, Date.now()))`  (copy `untilText` into queue via snooze.js). On needs-you rows add row buttons `SNOOZE` (opens conduct-snooze) and `RECOVER` (conduct-recover) next to REPLY/NUDGE; wrap them in `own()` and `cx.stop_propagation()` like the existing `button()`.
- Row chip "watching": if `a.watched`, show a dim "WATCH" label.

### Bar (conduct-bar)
A passive chip `SNOOZED n` (outline, `t.dim`, never filled/haloed), shown only when n > 0, after IDLE; n = `list.filter(a => a.snoozed).length`; clicking it could open the inbox. Exclude snoozed from the red chip counts and bottom border as above.

### sync-shared.sh
```sh
for m in conduct-snooze conduct-recover; do mkdir -p "$m"; cp conduct-bar/attn.js "$m/"; done
```
add both folders to the existing attn.js list, and if the queue imports them: `cp conduct-snooze/snooze.js conduct-queue/; cp conduct-recover/recover.js conduct-recover/recover-actions.js conduct-queue/`. If triage/queue need `untilText` only, copying `snooze.js` suffices.

### Layout / keys.json
Nothing: both mods open through `openOverlay` (or `run("mod.open",{name})`, their mod.json carries the overlay size). Register them wherever mods are listed for the layout (same place as conduct-send).

## (c) Not verified
- Only `herdr-app check` (loads the mod) and node tests; none of the UI was rendered, and no `hc` write command (send/interrupt/kill/run) was run. Layout, the hand-built toggle (a div, not gpui-base `Switch`), button wording and widths are untested.
- `hc get --json` fields (`argv, cwd, name, parent, keep, notify, rm, die_with_parent, foreground`) were taken from a live read of one terminal; `name` is null for most and flags were mapped from that (`die_with_parent:false` -> `--outlive-parent`).
- `hc kill` freeing a `--name` immediately is assumed; restart polls `hc get` for up to ~3 s before running.
- `--continue` for Claude is the "latest conversation in that cwd" behaviour; sibling agents in the same folder may pick each other's sessions.
- The model change makes snoozed agents `needs()`-true but not `unseen`; each consumer must also filter on `snoozed` (listed above).

## (d) Check in the live window
- Snooze an agent from the inbox: it leaves the queue at once; the sidebar shows it compactly with "snoozed until HH:MM"; it comes back unread at the time, or immediately if it changes state.
- The snooze dialog fits at width 0.3 (five preset rows plus the custom row without clipping; the toggle's knob position).
- Recover dialog: the confirm flow for Restart / End it, the result box, that the screen tail refreshes, and that a restarted agent appears under its parent with its name and `--keep` flags. Test only on a throwaway `fake-agent.sh` terminal.
- Auto-nudge: turn on with 1 minute on a fake stuck agent; confirm exactly one status line is typed per stall.
