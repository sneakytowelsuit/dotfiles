// Usage widgets (gpui-kit builders): a context-window bar, the prompt-cache countdown, a per-turn cache sparkline and a
// two-line mini control for sidebar rows. `u` is one agent's usage as stored in shared("conduct.usage")[address]
// (see usage.js); when it is missing every builder returns an empty div. Colours come from the theme `t` only.
// Copied next to usage.js by sync-shared.sh (edit the copy in conduct-usage/).
import { div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { cacheTimer as timerOf, kilo, money, clock, outcome, NEAR_FULL } from "./usage.js";

const none = () => div();
const clamp = (x) => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));
const pct = (x) => `${Math.round(clamp(x) * 100)}%`;

/** Bar colour by room left in the window: plain while there is plenty, gold below half, the blocked colour below a fifth. */
export const ctxColor = (t, frac) => (frac < 0.5 ? t.done ?? t.accent : frac < 0.8 ? t.working : t.blocked);
/** Cache timer colours. A cold cache is only alarming in an agent that is working (`hot`). */
export const timerColor = (t, state, hot = false) => (state === "warm" ? t.done ?? t.accent : state === "cooling" ? t.working : hot ? t.blocked : t.dim);

const track = (t, w, h, fill, color, pulse) =>
  div().relative().flex_none().overflow_hidden().h(h).rounded(h / 2).bg(t.border).when(w != null, (d) => d.w(w)).when(w == null, (d) => d.flex_1().min_w(0))
    .child(div().absolute().left(0).top(0).h_full().w(pct(fill)).rounded(h / 2).bg(color).when(pulse, (d) => d.loop("opacity", { from: 0.55, to: 1, period: 900 })));

/** "412k / 1M · 41%" */
export const ctxLabel = (u) => `${kilo(u.ctx.used)} / ${kilo(u.ctx.total)} · ${pct(u.ctx.frac)}`;

/** A thin bar of how full the context window is, with a label ("412k / 1M · 41%") unless `label: false`. Pulses above 90% full. */
export function contextBar(t, u, { width = null, height = 6, label = true } = {}) {
  if (!u?.ctx) return none();
  const f = clamp(u.ctx.frac);
  const color = ctxColor(t, f);
  const hot = f >= NEAR_FULL;
  const left = u.ctx.turnsLeft != null && f > 0.5 ? ` · ~${u.ctx.turnsLeft} turns left` : "";
  return h_flex().items_center().gap(6).min_w(0).when(width != null, (d) => d.w(width)).when(width == null, (d) => d.flex_1())
    .tooltip(`Context: ${kilo(u.ctx.used)} of ${kilo(u.ctx.total)} tokens used, ${kilo(u.ctx.left)} left${left}`)
    .child(track(t, null, height, f, color, hot))
    .when(label, (d) => d.child(div().flex_none().text_size(10).text_color(hot ? color : t.muted).child(ctxLabel(u))));
}

/** The cache countdown text and state for the label. */
export function timerText(u, now = Date.now()) {
  const c = timerOf(u?.cache, now);
  if (!c) return null;
  if (c.state === "cold") return { c, text: "cache cold", extra: u.cache.coldExtra > 0 ? `+${money(u.cache.coldExtra)} next turn` : "" };
  return { c, text: `cache ${clock(c.remaining)}`, extra: "" };
}

/**
 * A bar that drains from full to empty over the cache's lifetime, with "cache 3m 12s" beside it; when it has run out,
 * "cache cold" and the extra the next turn will cost to re-create the cache. `hot`: the agent is working (cold is red).
 */
export function cacheTimer(t, u, { width = null, height = 6, hot = false, now = Date.now() } = {}) {
  const x = timerText(u, now);
  if (!x) return none();
  const color = timerColor(t, x.c.state, hot);
  return h_flex().items_center().gap(6).min_w(0).when(width != null, (d) => d.w(width)).when(width == null, (d) => d.flex_1())
    .tooltip(x.c.state === "cold"
      ? `Prompt cache expired (${Math.round(x.c.ttl / 60)} min lifetime): the next turn re-creates it at full price${x.extra ? `, about ${x.extra}` : ""}`
      : `Prompt cache: ${clock(x.c.remaining)} left of ${Math.round(x.c.ttl / 60)} min. Each reply renews it.`)
    .child(track(t, null, height, x.c.frac, color, false))
    .child(div().flex_none().text_size(10).text_color(color).child(x.text))
    .when(Boolean(x.extra), (d) => d.child(div().flex_none().text_size(10).text_color(t.muted).child(x.extra)));
}

/** Up to 10 tiny bars, one per recent turn: tall for a cache hit, short for a miss (in the dim blocked colour). */
export function cacheSpark(t, u, { height = 14, bar = 3 } = {}) {
  const seq = u?.cache?.seq;
  if (!seq?.length) return none();
  const hits = seq.filter((r) => outcome(r) === "hit").length;
  return h_flex().flex_none().items_end().gap(2).h(height)
    .tooltip(`Cache hits, last ${seq.length} turns: ${hits} hit, ${seq.length - hits} partial or miss (${pct(u.cache.ratio)} of tokens read from cache)`)
    .children(seq.map((r) => {
      const o = outcome(r);
      return div().flex_none().w(bar).h(Math.max(2, Math.round(height * (o === "miss" ? 0.25 : clamp(r) * 0.9 + 0.1)))).rounded(1)
        .bg(o === "hit" ? t.done ?? t.accent : o === "partial" ? t.working : (t.blocked ?? t.dim) + "88");
    }));
}

/** Two lines for a sidebar row: the context bar (no label, label in the tooltip) over a thin cache-timer line. */
export function miniHealth(t, u, { hot = false, now = Date.now() } = {}) {
  if (!u?.ctx) return none();
  const c = timerOf(u.cache, now);
  const color = c ? timerColor(t, c.state, hot) : t.dim;
  return v_flex().w_full().gap(2).min_w(0)
    .tooltip(`${ctxLabel(u)}${c ? ` · ${c.state === "cold" ? "cache cold" : `cache ${clock(c.remaining)}`}` : ""}`)
    .child(track(t, null, 4, u.ctx.frac, ctxColor(t, clamp(u.ctx.frac)), u.ctx.frac >= NEAR_FULL))
    .child(track(t, null, 2, c ? c.frac : 0, color, false));
}
