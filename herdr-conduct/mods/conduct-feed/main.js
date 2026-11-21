// Conduct layout: the activity feed, "while you were away". A timeline of what the agents did (blocked, finished,
// appeared, ended, ...) grouped by day, with a divider where you last looked. The poller in conduct-queue
// records it (observe.js) into the shared value "conduct.feed"; opening this sets "conduct.feed.seen".

import { View, div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { props, closeOverlay, notify, theme, shared, setShared } from "herdr";
import { colorOf, ink, model, go } from "./attn.js";
import { groupByDay, filterFeed, unreadCount, hhmm, CHIP } from "./feed.js";

export { unreadCount };
const STATES = ["blocked", "error", "stalled", "done", "working", "idle", "new", "ended", "unstuck"];
const CRITICAL = new Set(["blocked", "error", "stalled"]);

export default class ConductFeed extends View {
  init(_p, cx) {
    this.cx = cx;
    this.feed = Array.isArray(shared("conduct.feed")) ? shared("conduct.feed") : [];
    this.prevSeen = Number(shared("conduct.feed.seen")) || 0; // the divider stays here while the dialog is open
    this.unread = unreadCount(this.feed, this.prevSeen);
    setShared("conduct.feed.seen", Date.now());
    this.states = new Set();
    this.primary = null;
    this.handle = cx.focus_handle();
    cx.timer.after(150, () => this.handle.focus());
    cx.timer.every(4000, (cx) => { this.feed = Array.isArray(shared("conduct.feed")) ? shared("conduct.feed") : this.feed; cx.notify(); });
  }

  on(fn) { return () => fn(); } // never keep a handler's cx (invalid after an await); this.cx is init's AsyncContext

  key(e, cx) { if (e.key === "escape") { closeOverlay(props().overlay); cx.stop_propagation(); } }

  markAllSeen() {
    const now = Date.now();
    this.prevSeen = now;
    this.unread = 0;
    setShared("conduct.feed.seen", now);
    this.cx.notify();
  }

  toggleState(s) { this.states.has(s) ? this.states.delete(s) : this.states.add(s); this.cx.notify(); }

  open(address) {
    const n = model().nodes.get(address);
    if (!n) { notify({ title: "That agent has ended", level: "info", timeout: 2500 }); return; }
    go(n);
    closeOverlay(props().overlay);
  }

  chip(t, id, label, on, color, fn) {
    return h_flex().id(id).h(24).px(10).items_center().rounded(12).cursor_pointer().text_size(10).font_semibold()
      .border_1().border_color(on ? color : t.border)
      .when(on, (d) => d.bg(color + "26").text_color(color))
      .when(!on, (d) => d.text_color(t.muted).hover((x) => x.bg(t.hover)))
      .on_click(this.on(fn)).child(label);
  }

  row(t, e) {
    const color = colorOf(t, e.to === "stalled" ? "stalled" : CRITICAL.has(e.to) || e.to === "done" || e.to === "working" ? e.to : "idle");
    const crit = CRITICAL.has(e.to);
    const dot = div().flex_none().size(10).rounded_full().border_1().border_color(color).when(crit, (d) => d.bg(color));
    return h_flex().id(`f-${e.t}-${e.address}-${e.to}`).gap(10).px(8).py(6).items_center().rounded(6).cursor_pointer()
      .hover((x) => x.bg(t.hover)).on_click(this.on(() => this.open(e.address)))
      .child(div().flex_none().w(40).text_size(11).text_color(t.dim).child(hhmm(e.t)))
      .child(dot)
      .child(v_flex().flex_1().min_w(0).gap(1)
        .child(div().truncate().text_size(12).text_color(crit ? t.foreground : t.muted).when(crit, (d) => d.font_semibold()).child(e.text))
        .when(Boolean(e.parentTitle), (d) => d.child(div().truncate().text_size(10).text_color(t.dim).child(`↳ ${e.parentTitle}`))))
      .child(div().flex_none().text_size(9).font_semibold().text_color(crit ? color : t.dim).child(CHIP[e.to] ?? e.to));
  }

  render(cx) {
    const t = theme();
    const list = filterFeed(this.feed, { states: this.states, primary: this.primary });
    const groups = groupByDay(list, Date.now());
    const primaries = [...new Map(this.feed.filter((e) => e.parent).map((e) => [e.parent, e.parentTitle ?? e.parent])).entries()].slice(0, 6);
    let dividerPlaced = false;
    const divider = () => h_flex().gap(8).py(8).items_center()
      .child(div().flex_1().h(1).bg(t.accent))
      .child(div().flex_none().text_size(10).font_semibold().text_color(t.accent).child("SINCE YOU LAST LOOKED ↑"))
      .child(div().flex_1().h(1).bg(t.accent));
    const body = [];
    for (const g of groups) {
      body.push(div().pt(12).pb(4).text_size(10).font_semibold().text_color(t.dim).child(g.label.toUpperCase()));
      for (const e of g.events) {
        if (!dividerPlaced && this.prevSeen && e.t <= this.prevSeen) { dividerPlaced = true; body.push(divider()); }
        body.push(this.row(t, e));
      }
    }
    return v_flex().id("c-feed").track_focus(this.handle).on_key_down((e, cx) => this.key(e, cx))
      .w_full().h_full().p(18).gap(10).bg(t.popover).text_color(t.foreground)
      .child(h_flex().items_center().gap(10)
        .child(div().text_size(15).font_semibold().child("While you were away"))
        .child(this.unread > 0
          ? div().h(18).px(7).flex().items_center().rounded(9).text_size(10).font_semibold().bg(t.accent).text_color(t.accent_foreground).child(`${this.unread} new`)
          : div().text_size(11).text_color(t.dim).child("nothing new"))
        .child(div().flex_1())
        .child(h_flex().id("f-markseen").h(28).px(12).items_center().rounded(8).cursor_pointer().text_size(11).font_semibold()
          .border_1().border_color(t.input).bg(t.raised).hover((x) => x.opacity(0.88)).on_click(this.on(() => this.markAllSeen())).child("Mark all seen"))
        .child(div().text_size(11).text_color(t.dim).child("Esc")))
      .child(h_flex().gap(6).flex_wrap()
        .children(STATES.map((s) => this.chip(t, `f-s-${s}`, CHIP[s], this.states.has(s), CRITICAL.has(s) ? colorOf(t, s) : t.accent, () => this.toggleState(s)))))
      .when(primaries.length > 1, (d) => d.child(h_flex().gap(6).flex_wrap().items_center()
        .child(div().text_size(10).text_color(t.dim).child("PRIMARY"))
        .child(this.chip(t, "f-p-all", "All", this.primary == null, t.accent, () => { this.primary = null; this.cx.notify(); }))
        .children(primaries.map(([a, title]) => this.chip(t, `f-p-${a}`, title, this.primary === a, t.accent, () => { this.primary = this.primary === a ? null : a; this.cx.notify(); })))))
      .child(v_flex().id("f-body").flex_1().min_h(0).overflow_y_scrollbar().pr(6)
        .when(groups.length === 0, (d) => d.child(v_flex().py(40).items_center().gap(6)
          .child(div().text_size(13).text_color(t.muted).child(this.feed.length ? "Nothing matches these filters." : "Nothing has happened yet."))
          .child(div().text_size(11).text_color(t.dim).child("Agents blocking, finishing, appearing or ending show up here, even while you are away.")))
        )
        .children(body));
  }
}
