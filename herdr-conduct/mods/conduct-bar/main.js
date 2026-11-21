// Conduct layout: the top bar is an agent monitor. One chip per status with its count: outlined when
// nothing needs you, filled with a pulsing halo when something does (blocked, done and unseen).
// Below the counts, a chip per agent that needs you; click one to land in its terminal.

import { View, div, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { agents, spaces, run, theme, window as win, nextCommand, openOverlay, settings, shared } from "herdr";
import { first } from "./keys.js";
import { unreadCount } from "./feed.js";
import { readAllUsage } from "./usage-poll.js";
import { fleet, money } from "./usage.js";
import { ORDER, NAME, CRITICAL, needs, sorted, colorOf, ink, go, halo, nextNeeding, model, previous } from "./attn.js";
import { stateIcon, icon } from "./glyphs.js";

function own(el) {
  return el.on_mouse_down("left", (_e, cx) => cx.stop_propagation()).on_mouse_down("right", (_e, cx) => cx.stop_propagation());
}

export default class ConductBar extends View {
  init(_p, cx) {
    cx.timer.every(5000, (cx) => cx.notify()); // the cold-cache count changes with time
    // alt-n / alt-p (keys.json: "conduct-bar.next" / "conduct-bar.prev") jump through what needs you.
    cx.spawn(async () => {
      for (;;) {
        const c = await nextCommand();
        if (c === "nudge") { this.nudge(); continue; }
        if (c === "previous") { previous(); continue; }
        const a = nextNeeding(model().list, c === "prev" ? -1 : 1);
        if (a) go(a);
      }
    });
    this.i = {};
    this.hold = 0; // press counter: a pending long-press is void once it changes
    this.held = false; // the menu opened for this press, so the release must not cycle
  }

  // Press and hold: a menu of the agents in that state. A short press cycles through them.
  press(status, cx) {
    const n = ++this.hold;
    this.held = false;
    cx.timer.after(450, () => {
      if (this.hold !== n) return;
      this.held = true;
      openOverlay({ mod: "conduct-menu", kind: "popup", at: "pointer", width: 340, props: { status } });
    });
  }

  release(pick) {
    this.hold++;
    if (this.held) { this.held = false; return; }
    pick();
  }

  nudge() {
    openOverlay({ mod: "conduct-send", kind: "dialog", width: 0.5, props: { mode: "primary" } });
  }

  button(t, id, icon, onClick, danger) {
    return own(div())
      .id(id).flex_none().p(7).rounded(3).text_color(t.dim).cursor_pointer()
      .hover((s) => s.bg(danger ? t.solid : t.raised).text_color(danger ? t.solid_foreground : t.accent))
      .on_click(onClick)
      .child(svg(`mods/conduct-bar/${icon}.svg`).size(15));
  }

  // One right-hand pill: icon, text, number.
  pill(t, { id, glyph, label, n, color, fill, compact, tip, click }) {
    const ink_ = fill ? ink(color) : null;
    return own(h_flex()).id(id)
      .h(26).px(compact ? 8 : 11).gap(compact ? 5 : 6).items_center().rounded(13).cursor_pointer().text_size(11).font_semibold()
      .border_1().border_color(fill ? color : t.border)
      .when(fill, (el) => el.bg(color).text_color(ink_))
      .when(!fill, (el) => el.text_color(color === t.accent || color === t.muted ? t.dim : color).hover((x) => x.bg(t.hover)))
      .tooltip(tip)
      .on_click(click)
      .child(icon(glyph, 12).flex_none())
      .when(!compact, (el) => el.child(div().child(label)))
      .child(div().text_size(13).child(String(n)));
  }

  // Snoozed agents: a passive outline, never filled or haloed. Click opens the inbox.
  snoozedChip(t, n, compact) {
    return div().flex_none().px(5).py(5).child(
      own(h_flex()).id("c-snoozed").h(26).px(compact ? 8 : 10).gap(6).items_center().rounded(13).cursor_pointer().text_size(11).font_semibold()
        .border_1().border_color(t.border).text_color(t.dim).hover((x) => x.bg(t.hover))
        .tooltip(`${n} snoozed agent${n === 1 ? "" : "s"}. They come back when the snooze ends or their state changes.`)
        .on_click(() => run("mod.open", { name: "conduct-triage" }))
        .child(icon("snooze", 12).flex_none()).when(!compact, (el) => el.child(div().child("SNOOZED"))).child(div().text_size(13).child(String(n))),
    );
  }

  // A status counter. Attention statuses with agents are filled and haloed; the rest are outlines.
  count(t, status, n, list, compact) {
    const color = colorOf(t, status);
    const loud = (status === "blocked" || status === "error" || status === "stalled") && n > 0;
    const pick = () => {
      const q = list.filter((a) => a.status === status);
      if (!q.length) return;
      // Repeat clicks walk through the agents in that state.
      const k = (this.i[status] = ((this.i[status] ?? -1) + 1) % q.length);
      go(q[k]);
    };
    const chip = own(h_flex())
      .id(`c-c-${status}`)
      .h(26).px(compact ? 8 : 10).gap(compact ? 5 : 7).items_center().rounded(13).cursor_pointer().text_size(11).font_semibold()
      .border_1().border_color(n > 0 ? color : t.border)
      .when(n > 0, (el) => el.bg(color).text_color(ink(color)))
      .when(n === 0, (el) => el.text_color(t.dim).hover((s) => s.bg(t.hover)))
      .tooltip(n ? `${NAME[status]}: ${n}. Click: next one. Hold: choose.` : `${NAME[status]}: none`)
      .on_mouse_down("left", (_e, cx) => { if (n) this.press(status, cx); })
      .on_mouse_up("left", () => this.release(pick))
      // Compact (little room): a colour dot and the count; the name is in the tooltip.
      .child(stateIcon(t, status, 12).flex_none().text_color(n > 0 ? ink(color) : t.dim))
      .when(!compact, (el) => el.child(div().child(NAME[status])))
      .child(div().text_size(13).child(String(n)));
    return loud ? halo(color, 13, 5, chip) : div().flex_none().px(5).py(5).child(chip);
  }

  render() {
    const t = theme();
    const m = model();
    const list = m.list;
    const w = win() ?? {};
    const by = (st) => list.filter((a) => a.status === st && !a.snoozed);
    const nSnoozed = list.filter((a) => a.snoozed).length;
    const wants = sorted(list).filter((a) => CRITICAL.includes(a.status) && !a.snoozed);
    const shown = ORDER.filter((st) => by(st).length > 0 || ["blocked", "done", "working", "idle"].includes(st));
    const total = list.length;
    const ready = m.primaries.length > 0;
    // The status chips sit in the middle of the bar: a layer placed over it (painted first, so the buttons stay on top),
    // padded by the width of the right-hand buttons on both sides so they are centred on the window. When that leaves too
    // little room (a narrow window or a big zoom) only the small agent count is kept clear on the left, and past that the
    // chips scroll sideways.
    // The measured width is the real window width; every size below is a design size that grows with zoom.
    const zoom = Number(settings()?.zoom) || 1;
    const right = (this.rightW ?? 620) / zoom + 14; // measured width of the right-hand group (cost, FEED, INBOX, NUDGE, gear)
    const width = (this.barW ?? 1400) / zoom;
    const need = shown.length * 104 + 30;
    const centred = width - 2 * right >= need;
    const padL = centred ? right : 110;
    const compact = !centred && width - 110 - right < need; // not even room beside the buttons: dots and counts only
    // The right-hand pills all read icon / text / number. Filled in a colour when the number means something to act on
    // (inbox, feed, nudge), a quiet outline otherwise; the text drops out first when there is little room.
    const unreadList = sorted(list).filter((a) => CRITICAL.includes(a.status) && a.unseen && !a.snoozed);
    const unread = unreadList.length;
    const hot = unread ? colorOf(t, unreadList[0].status) : t.accent;
    const feedN = unreadCount(shared("conduct.feed") ?? [], Number(shared("conduct.feed.seen")) || 0);
    const flagged = list.filter((a) => a.parent && needs(a)).length; // sub-agents a nudge would ask the primary about
    const f = fleet(readAllUsage());
    const pressing = flagged > 0 && ready;
    const inbox = this.pill(t, { id: "c-inbox", glyph: "inbox", label: "INBOX", n: unread, color: hot, fill: unread > 0, compact,
      tip: `Triage: step through the critical unread, on hotkeys (${first("g.inbox")})`, click: () => run("mod.open", { name: "conduct-triage" }) });
    const feed = this.pill(t, { id: "c-feed", glyph: "feed", label: "FEED", n: feedN, color: t.accent, fill: feedN > 0, compact,
      tip: `What happened while you were away (${first("g.feed")})`, click: () => run("mod.open", { name: "conduct-feed" }) });
    const nudge = this.pill(t, { id: "c-nudge", glyph: "nudge", label: "NUDGE", n: ready ? flagged : 0, color: t.accent, fill: pressing, compact,
      tip: ready ? `Ask a primary agent to check on its sub-agents (${first("g.nudge")})` : "No primary agent yet: one that has started sub-agents", click: () => this.nudge() });
    const cost = f.agents
      ? this.pill(t, { id: "c-cost", glyph: "cost", label: "SPEND", n: `${money(f.perHour)}/hr${f.cold ? ` · ❄ ${f.cold}` : ""}`, color: f.full ? t.blocked : t.muted, fill: false, compact,
          tip: `Claude Code usage: ${money(f.cost)} this session, ${f.cold} cold cache${f.cold === 1 ? "" : "s"}, ${f.full} near full (${first("g.usage")})`, click: () => run("mod.open", { name: "conduct-usage" }) })
      : div();
    const map = this.pill(t, { id: "c-map", glyph: "map", label: "MAP", n: total, color: t.muted, fill: false, compact,
      tip: `Agent map: every agent as a cell (${first("g.map")})`, click: () => run("mod.open", { name: "conduct-map" }) });
    return h_flex()
      .id("c-bar")
      .relative()
      .size_full()
      .items_center()
      .justify_between()
      .pl(12)
      .bg(t.chrome)
      .border_b(1)
      .border_color(wants.length ? t.blocked : t.border)
      .on_size_change((size, cx) => { if (Math.abs((this.barW ?? 0) - size.width) > 1) { this.barW = size.width; cx.notify(); } })
      .when(w.platform === "macos" && w.titlebar === "none" && !w.fullscreen, (el) => el.pl(72))
      .child(
        div().absolute().top(0).bottom(0).left(0).right(0).pl(padL).pr(right).flex().items_center()
          .child(
            h_flex().id("c-counts").flex_1().min_w(0).items_center().overflow_x_scrollbar()
              .child(h_flex().flex_none().mx_auto().items_center().gap(2).children([...shown.map((st) => this.count(t, st, by(st).length, list, compact)), ...(nSnoozed ? [this.snoozedChip(t, nSnoozed, compact)] : [])])),
          ),
      )
      .child(div().flex_none().text_size(11).font_semibold().text_color(t.dim).child(`${total} agent${total === 1 ? "" : "s"}`))
      .child(
        h_flex().id("c-right").flex_none().items_center()
          .on_size_change((size, cx) => { if (Math.abs((this.rightW ?? 0) - size.width) > 1) { this.rightW = size.width; cx.notify(); } })
          .child(div().flex_none().mr(8).child(map))
          .child(div().flex_none().mr(8).child(cost))
          .child(div().flex_none().mr(8).child(feed))
          .child(div().flex_none().mr(8).child(unread ? halo(hot, 13, 4, inbox) : inbox))
          .child(div().flex_none().mr(6).child(pressing ? halo(t.accent, 13, 4, nudge) : nudge))
          .child(this.button(t, "c-settings", "gear", () => run("mod.open", { name: "conduct-settings" })))
          .when(Boolean(w.buttons), (el) =>
            el.child(
              h_flex().flex_none().px(6).gap(2)
                .child(this.button(t, "c-min", "win-min", () => run("window.minimize")))
                .child(this.button(t, "c-max", w.maximized ? "win-restore" : "win-max", () => run("window.maximize")))
                .child(this.button(t, "c-close", "win-close", () => run("window.close"), true)),
            ),
          ),
      );
  }
}
