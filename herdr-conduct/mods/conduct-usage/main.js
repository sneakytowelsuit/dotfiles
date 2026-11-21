// Conduct layout: usage dialog. Fleet cost and efficiency for Claude Code agents: totals, then a row per agent with
// its context bar, prompt-cache countdown + per-turn sparkline, session cost, last turn cost and burn rate.
// Warnings (context nearly full, cache cold while working) come first. Click a row to go to that agent.
// Reads shared("conduct.usage") (filled by the poller via usage-poll.js); also refreshes it itself while open.
// Estimates only: prices are constants in usage.js.

import { View, div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { props, closeOverlay, theme, setShared } from "herdr";
import { model, go, colorOf, NAME } from "./attn.js";
import { inboxAction, show } from "./keys.js";
import { fleet, cacheTimer as timerOf, money, kilo, NEAR_FULL } from "./usage.js";
import { contextBar, cacheTimer, cacheSpark } from "./health.js";
import { pollUsage, readAllUsage, REFRESH_MS } from "./usage-poll.js";

const SORTS = [
  { id: "cost", label: "cost", by: (r) => r.u.cost.session },
  { id: "burn", label: "burn", by: (r) => r.u.rate.costPerHour },
  { id: "context", label: "context", by: (r) => r.u.ctx.frac },
  { id: "cache", label: "cache", by: (r) => timerOf(r.u.cache)?.remaining ?? -1, asc: true }, // coldest first
];
const shortModel = (m) => String(m ?? "").replace(/^claude-/, "").replace(/-\d{8}$/, "");

export default class ConductUsage extends View {
  init(_p, cx) {
    this.cx = cx;
    this.sort = "cost";
    this.ticks = 0;
    this.handle = cx.focus_handle();
    cx.timer.after(150, () => this.handle.focus());
    this.refresh();
    cx.timer.every(1000, (cx) => {
      if (++this.ticks % Math.round(REFRESH_MS / 1000) === 0) this.refresh();
      cx.notify(); // the countdowns
    });
  }

  refresh() {
    pollUsage(model().list)
      .then((m) => { if (m.size) setShared("conduct.usage", Object.fromEntries(m)); this.cx.notify(); })
      .catch(() => {});
  }

  rows() {
    const map = readAllUsage();
    const rows = model().list.filter((n) => map[n.address]).map((n) => ({ n, u: map[n.address] }));
    const warn = (r) => (r.u.ctx.frac >= NEAR_FULL ? 2 : 0) + (r.n.raw === "working" && r.u.live?.state === "cold" ? 1 : 0);
    const s = SORTS.find((x) => x.id === this.sort) ?? SORTS[0];
    rows.sort((a, b) => warn(b) - warn(a) || (s.asc ? s.by(a) - s.by(b) : s.by(b) - s.by(a)));
    return { rows, map, warn };
  }

  key(e, cx) {
    if (inboxAction(e.keystroke) === "close") { closeOverlay(props().overlay); cx.stop_propagation(); }
  }
  on(fn) { return () => fn(); }

  stat(t, label, value, color) {
    return v_flex().gap(1).flex_none()
      .child(div().text_size(18).font_semibold().text_color(color ?? t.foreground).child(value))
      .child(div().text_size(10).text_color(t.dim).child(label));
  }

  head(t, f) {
    return h_flex().items_end().gap(26).flex_wrap()
      .child(this.stat(t, "session cost", money(f.cost)))
      .child(this.stat(t, "burn rate", `${money(f.perHour)}/hr`))
      .child(this.stat(t, "cache hit ratio", `${Math.round(f.ratio * 100)}%`))
      .child(this.stat(t, "saved by cache", money(f.savings), t.done))
      .child(this.stat(t, "cold caches", String(f.cold), f.cold ? t.working : t.dim))
      .child(this.stat(t, "context near full", String(f.full), f.full ? t.blocked : t.dim));
  }

  row(t, r, warn) {
    const { n, u } = r;
    const working = n.raw === "working";
    const full = u.ctx.frac >= NEAR_FULL;
    const cold = u.live?.state === "cold";
    const flag = full ? t.blocked : working && cold ? t.working : null;
    const num = (w, v, c) => div().flex_none().w(w).text_size(11).text_color(c ?? t.foreground).child(v);
    return h_flex().id(`u-${n.address}`).gap(10).items_center().px(10).py(7).rounded(6).cursor_pointer()
      .bg(t.surface).border_1().border_color(flag ?? t.border).hover((x) => x.bg(t.hover))
      .tooltip(`Go to ${n.title}`)
      .on_click(this.on(() => { go(n); closeOverlay(props().overlay); }))
      .child(div().flex_none().size(7).rounded_full().bg(colorOf(t, n.status)))
      .child(v_flex().w(150).flex_none().min_w(0).gap(1)
        .child(div().truncate().text_size(12).font_semibold().child(n.title))
        .child(div().truncate().text_size(10).text_color(t.dim).child(`${shortModel(u.model)}${u.cost.known ? "" : " · price guessed"} · ${NAME[n.status]}`)))
      .child(div().flex_1().min_w(120).child(contextBar(t, u, { height: 6 })))
      .child(h_flex().flex_none().w(250).gap(8).items_center()
        .child(div().flex_1().min_w(0).child(cacheTimer(t, u, { hot: working })))
        .child(cacheSpark(t, u)))
      .child(num(58, money(u.cost.session)))
      .child(num(58, money(u.cost.lastTurn), t.muted))
      .child(num(70, `${money(u.rate.costPerHour)}/hr`, u.rate.costPerHour > 0 ? t.foreground : t.dim));
  }

  render() {
    const t = theme();
    const { rows, map, warn } = this.rows();
    const f = fleet(map);
    const colHead = h_flex().gap(10).px(10).text_size(10).text_color(t.dim)
      .child(div().flex_none().w(7)).child(div().flex_none().w(150).child("agent")).child(div().flex_1().min_w(120).child("context"))
      .child(div().flex_none().w(250).child("prompt cache · last 10 turns")).child(div().flex_none().w(58).child("session"))
      .child(div().flex_none().w(58).child("last turn")).child(div().flex_none().w(70).child("burn"));
    return v_flex().id("c-usage").track_focus(this.handle).on_key_down((e, cx) => this.key(e, cx))
      .w_full().h_full().p(18).gap(12).bg(t.popover).text_color(t.foreground).border_t(3).border_color(f.full ? t.blocked : t.accent)
      .child(h_flex().items_center().gap(10)
        .child(div().text_size(15).font_semibold().child("Usage"))
        .child(div().text_size(11).text_color(t.dim).child(`${f.agents} Claude Code agent${f.agents === 1 ? "" : "s"}`))
        .child(div().flex_1())
        .child(h_flex().gap(4).items_center()
          .child(div().text_size(10).text_color(t.dim).child("sort"))
          .children(SORTS.map((s) => h_flex().id(`u-s-${s.id}`).h(22).px(9).items_center().rounded(11).cursor_pointer().text_size(10).font_semibold()
            .border_1().border_color(this.sort === s.id ? t.accent : t.border)
            .when(this.sort === s.id, (d) => d.bg(t.accent + "22").text_color(t.accent))
            .when(this.sort !== s.id, (d) => d.text_color(t.muted).hover((x) => x.bg(t.hover)))
            .on_click(this.on(() => { this.sort = s.id; this.cx.notify(); })).child(s.label))))
        .child(div().text_size(11).text_color(t.dim).child(show("close"))))
      .child(this.head(t, f))
      .child(v_flex().id("c-usage-body").flex_1().min_h(0).overflow_y_scrollbar().gap(6).pr(4)
        .child(colHead)
        .children(rows.length
          ? rows.map((r) => this.row(t, r, warn(r)))
          : [v_flex().items_center().gap(6).py(50)
              .child(div().text_size(16).font_semibold().child("No usage yet"))
              .child(div().text_size(12).text_color(t.dim).child("Shown for Claude Code agents on this computer once they have answered at least once (needs jq)."))]))
      .child(div().text_size(10).text_color(t.dim).child(
        "Estimates from the usage numbers in Claude Code's session transcripts (never the messages). Prices are list-price constants in usage.js (PRICES), " +
        "so edit them there; unknown models use a Sonnet-like guess. Context counts the last turn's input + cache tokens against the model's window. " +
        "The prompt cache lives 5 minutes (1 hour for 1-hour writes) after its last use; when cold, the next turn re-creates it at full price. " +
        "Burn is the last 10 minutes (new tokens only, cache reads excluded). Sub-agents running in the same folder share one transcript, so they show the same numbers. " +
        "Session totals cover the last 20 MB of a long transcript."));
  }
}
