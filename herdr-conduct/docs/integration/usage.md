# Track "usage": cost and efficiency for Claude Code agents

## (a) What was built

Files (all new): `mods/conduct-usage/{mod.json,main.js,usage.js,usage-poll.js,health.js,attn.js,keys.js}` (attn.js and keys.js are plain copies), `test/usage/usage.test.mjs` (17 node tests, synthetic data only).

**Data.** For every local Claude Code agent (`app === "claude-code"`, not on a remote machine) `usage-poll.js` finds the newest `~/.claude/projects/<cwd with every non-alphanumeric character as "-">/*.jsonl` (cwd from `terminals()` `cwd`/`foreground.cwd`, else the pane's cwd) and runs one `sh` script through `exec`. The script reads only the bytes added since last time (a first read looks at the last 20 MB), keeps the lines containing `"usage"` and pipes them through `jq`, which emits only `timestamp`, `message.id`, `message.model` and the numeric usage fields. Message text never reaches Herdr or the mod. Responses written several times (streaming) collapse by message id; sidechain lines are skipped. Per agent it keeps per-model totals for the session, the last 40 turns, and the file offset. Each agent is refreshed at most every 20 s, at once when its status changes; up to 3 in parallel. Needs `jq` on the PATH. Limitation: sub-agents started in the same folder share the newest transcript, so they show the same numbers.

**Stored value** `shared("conduct.usage")` = `{ [address]: { ctx:{used,total,frac,left,turnsLeft}, cache:{ratio,last,seq:[0..1 x<=10],ttl,lastAt,coldExtra}, cost:{session,lastTurn,savings,turns,known,partial}, rate:{tokPerMin,costPerHour}, model, at } }`. `readUsage(address)` / `readAllUsage()` (in usage-poll.js) read it without I/O and add `live` (the cache countdown at the current time: `{state:"warm"|"cooling"|"cold", remaining, frac, ttl}`).

**Metrics (usage.js, pure).** Context used = input + cache read + cache creation of the last turn against the model window (1M; 200K for Haiku 4.5 and older; `WINDOW_SMALL`). Turns until full = remaining / mean growth per turn over the last 8 turns of the current stretch (a >20% drop = compaction, growth restarts). Hit ratio = cacheRead / (cacheRead + creation + fresh input), for the last turn and over the last 10; per-turn outcome hit >= 0.9, partial >= 0.3, miss. Cache TTL 300 s, or 3600 s when the latest turn that wrote cache wrote 1h entries; state warm, cooling (< 60 s or < 25% left), cold (expired). Prices: `PRICES` in usage.js, USD per million tokens, "as of 2026-11" (Opus 5/25, legacy Opus 15/75, Sonnet 3/15, Haiku 1/5; cache read 0.1x, 5m write 1.25x, 1h write 2x); unknown models use a Sonnet-like guess and are flagged `known:false` (the dialog says "price guessed"). Savings = cache reads at full input price minus their price. `coldExtra` = context size x (cache write price - cache read price), the extra the next turn costs if the cache is cold. Burn = new tokens (input + output + creation; cache reads excluded) per minute and cost per hour over the last 10 minutes (window shrinks to the age of the first turn in it, min 1 min).

**health.js (gpui-kit builders, theme colours only; each returns an empty `div()` when `u` is missing).**
- `contextBar(t,u,{width,height=6,label=true})`: track in `t.border`, fill in `t.done` (fraction used < 0.5), `t.working` (< 0.8), `t.blocked` (>= 0.8: under 20% left, as dcc's crawlerColor); the fill pulses (opacity 0.55 to 1 over 0.9 s) only at >= 90% full; label `412k / 1M · 41%` 10px (coloured at >= 90%); tooltip with tokens left and turns left.
- `cacheTimer(t,u,{width,height=6,hot,now})`: a bar that drains from full to empty over the TTL, label `cache 3m 12s` (seconds under a minute); warm `t.done`, cooling `t.working`, cold `t.dim` (or `t.blocked` when `hot: true`, pass it for working agents), label `cache cold` plus `+$0.42 next turn`.
- `cacheSpark(t,u)`: up to 10 bars (3px wide, 14px tall, 2px gap), height by hit ratio; hit `t.done`, partial `t.working`, miss short in `t.blocked` at 53% alpha ("dim blocked-ish").
- `miniHealth(t,u,{hot})`: two stacked thin bars (4px context, 2px cache timer), no text, tooltip with both labels. For sidebar rows.
- The countdown is computed at render time from `lastAt`, so hosts only need a repaint timer (see below).

**Dialog `conduct-usage`** (dialog 0.62 x 0.86, 3px top strip in accent, `t.blocked` when any context is near full). Header: `Usage`, agent count, sort chips (`cost`, `burn`, `context`, `cache`; outline chips, selected one accent-tinted), the close key. Then fleet totals (18px): session cost, burn `$/hr`, cache hit ratio (weighted by context size), saved by cache, cold caches, context near full. Body (scrolling): column heads, then one clickable row per agent: status dot, title + `model · STATE`, context bar with label, cache timer + sparkline, session cost, last turn cost, burn. Rows are ordered warnings first (context >= 90% weighs 2, cold cache while working weighs 1; those rows get a border in `t.blocked` / `t.working`), then by the chosen sort (cache sort: coldest first). Click a row: `go(agent)` and close. Footer: the estimate/price/limitations footnote. A 1 s timer repaints the countdowns; every 20 s the dialog also calls `pollUsage` itself and writes `conduct.usage` (so it works before and without the queue wiring). Close uses the existing `close` inbox action (Esc, q, t by default; nothing hard-coded).

Privacy paragraph for the README (paste under "Watch out"):

> **Claude Code usage.** The Usage dialog and the health bars read only usage numbers (token counts), model names and timestamps from Claude Code's session transcripts in `~/.claude/projects/`, through a `jq` filter that emits nothing else. Message text is never read, logged or stored. Costs are estimates from list prices kept as constants in `mods/conduct-usage/usage.js`.

## (b) Edits for the integrator

**sync-shared.sh**: add the three modules and the dependency chain to every mod that draws or polls:
```sh
for m in conduct-queue conduct-pane conduct-bar; do cp conduct-usage/usage.js conduct-usage/usage-poll.js conduct-usage/health.js "$m/"; done
```
(also add `conduct-usage` to the `attn.js` loop; `keys.js` is only used by conduct-usage among the new mod: add `conduct-usage` to the `keys.js` loop). Note `cd mods` is already the working directory, so the paths above are right. conduct-usage is the source folder of usage.js, usage-poll.js, health.js (edit them there).

**keys.js** `ACTIONS` (after `g.settings`):
```js
{ id: "g.usage", scope: "global", label: "Open the usage dialog", command: "mod.open:conduct-usage", def: ["ctrl-alt-u"] },
```
and in `keys.json` section `layout:conduct`: `"ctrl-alt-u": "mod.open:conduct-usage"`. (Everything else in keys.js stays; the copy in conduct-usage only needs `inboxAction`/`show`.)

**conduct-queue/main.js**
```js
import { pollUsage, readUsage } from "./usage-poll.js";
import { miniHealth } from "./health.js";
```
At the end of `poll()` (do not await: the first read of a long transcript takes a second or two):
```js
pollUsage(m.list).then((u) => {
  const o = Object.fromEntries(u);
  if (JSON.stringify(o) !== JSON.stringify(shared("conduct.usage") ?? {})) setShared("conduct.usage", o);
}).catch(() => {});
```
pollUsage throttles itself (20 s per agent, at once on a status change), so it is safe in the 4 s poller. Change the repaint timer `cx.timer.every(15000, ...)` to `5000` so the thin cache lines drain visibly.
In `line(t, a, indent)`, before the age child:
```js
.child(div().flex_none().w(46).child(miniHealth(t, readUsage(a.address), { hot: a.status === "working" })))
```
In `primary(t, p, m)`, right after the title row `h_flex()` (the one with the star), add a row:
```js
v_flex().mx(8).px(8).pt(4).child(miniHealth(t, readUsage(p.address), { hot: p.status === "working" })),
```
`readUsage` returns null for agents without data and `miniHealth` then renders an empty div, so non-Claude agents are unaffected. Optionally the same `miniHealth` under the NEEDS YOU card's title (a blocked agent with a cold cache is the expensive one to answer late).

**conduct-pane/main.js**
```js
import { readUsage } from "./usage-poll.js";
import { contextBar, cacheTimer } from "./health.js";
```
Change `init` to `cx.timer.every(2000, (cx) => cx.notify())` (seconds countdown). In `render()`: `const u = a ? readUsage(a.address) : null;`. Along the bottom edge of the header (after the stripe child): `.child(div().absolute().left(0).bottom(0).w_full().child(contextBar(t, u, { height: 2, label: false })))`. In the tag area, before the state pill: `.when(Boolean(u), (el) => el.child(div().flex_none().w(190).child(cacheTimer(t, u, { width: 190, height: 4, hot: st === "working" }))))`. The header is 30px; the 2px bar sits on the border line, the timer is 4px tall inside the row. If the pane is narrow, drop the timer when `a?.children.length` branch text is also shown (the branch is `max_w(220)` and truncates first).

**conduct-bar/main.js** (small indicator, left of the INBOX pill)
```js
import { readAllUsage } from "./usage-poll.js";
import { fleet, money } from "./usage.js";
...
const f = fleet(readAllUsage());
const cost = f.agents ? own(h_flex()).id("c-cost").h(26).px(11).gap(6).items_center().rounded(13).cursor_pointer().text_size(11).font_semibold()
  .border_1().border_color(f.full ? t.blocked : t.border).text_color(f.full ? t.blocked : t.muted).hover((x) => x.bg(t.hover))
  .tooltip(`Claude Code usage: ${money(f.cost)} this session, ${f.cold} cold cache${f.cold === 1 ? "" : "s"}, ${f.full} near full (${first("g.usage")})`)
  .on_click(() => run("mod.open", { name: "conduct-usage" }))
  .child(`${money(f.perHour)}/hr${f.cold ? ` · ❄ ${f.cold}` : ""}`) : div();
```
and put `cost` first in the right-hand `h_flex()` (before the `halo(hot...)` inbox child, `.mr(8)`). It is an outline, never filled or haloed. Raise `const right = w.buttons ? 420 : 320` by 130 (to 550 / 450) so the centred chips still clear it. Add `cx.timer.every(5000, (cx) => cx.notify())` in the bar's `init` if it has none (the cold count changes with time). The `first` import from keys.js is already there.

**conduct-triage / conduct-settings**: nothing required. Settings for the price table are deliberately not added: prices change rarely and a wrong number silently skews every total, so they stay as the commented constants in usage.js (`PRICES`). If wanted later, a shared value `conduct.prices` could override `PRICES` entries in `priceFor`.

**RECIPE/README**: paste (a) and the privacy paragraph; add `Usage` and `jq` to the requirements; mention `ctrl-alt-u`.

## (c) Not verified

- `herdr-app check herdr-conduct/mods/conduct-usage` passes (module loads), but `render` paths were never executed: no window access (hard rule). The gpui-kit calls follow existing mods (`w("40%")` percent strings are per the d.ts LengthString).
- The shell script was run against a synthetic transcript folder (incremental offset, unfinished last line, message text excluded from output); real Herdr `exec` PATH containing `jq` is assumed.
- The `terminals()` `cwd` / `foreground.cwd` field names are as the brief says; the pane cwd is a fallback (the shell's folder may differ from the folder Claude was started in, in which case no transcript is found and nothing shows).
- Remote detection: the space's `machine`, or an address containing `/` or `:`.
- Prices for 5.x models (Opus 5 / Fable at Opus rates, Sonnet 5 at Sonnet rates) are assumptions; edit `PRICES`.

## (d) Check in the live window

- With a real Claude Code agent: numbers appear within about 20 s; the context fraction agrees with `/context` roughly; a first read of a very large transcript does not stall the 4 s poller (it is not awaited).
- The countdown drains and flips warm, cooling, cold at the TTL (5 min vs 1 h depending on the agent's cache writes).
- The row layout of the dialog at the default window size and at high zoom (fixed column widths: agent 150, cache 250, cost 58/58/70; context bar flexes, min 120).
- Mini bars in sidebar lines are not too noisy; the pane header timer fits next to the branch and state pill.
- Opening the dialog from the bar pill and `ctrl-alt-u`; clicking a row goes to the agent and closes the dialog.
