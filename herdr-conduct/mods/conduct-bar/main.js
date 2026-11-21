// Conduct layout: the top bar is an agent monitor. One chip per status with its count: outlined when
// nothing needs you, filled with a pulsing halo when something does (blocked, done and unseen).
// Below the counts, a chip per agent that needs you; click one to land in its terminal.

import { View, div, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { agents, spaces, run, theme, window as win, nextCommand, openOverlay } from "herdr";
import { first } from "./keys.js";
import { ORDER, NAME, CRITICAL, sorted, colorOf, ink, go, halo, nextNeeding, model } from "./attn.js";

function own(el) {
  return el.on_mouse_down("left", (_e, cx) => cx.stop_propagation()).on_mouse_down("right", (_e, cx) => cx.stop_propagation());
}

export default class ConductBar extends View {
  init(_p, cx) {
    // alt-n / alt-p (keys.json: "conduct-bar.next" / "conduct-bar.prev") jump through what needs you.
    cx.spawn(async () => {
      for (;;) {
        const c = await nextCommand();
        if (c === "nudge") { this.nudge(); continue; }
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

  // A status counter. Attention statuses with agents are filled and haloed; the rest are outlines.
  count(t, status, n, list) {
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
      .h(26).px(10).gap(7).items_center().rounded(13).cursor_pointer().text_size(11).font_semibold()
      .border_1().border_color(n > 0 || status === "done" ? color : t.border)
      .when(loud, (el) => el.bg(color).text_color(ink(color)))
      .when(!loud, (el) => el.text_color(n > 0 || status === "done" ? color : t.dim).hover((s) => s.bg(t.hover)))
      .tooltip(n ? `${NAME[status]}: ${n}. Click: next one. Hold: choose.` : `${NAME[status]}: none`)
      .on_mouse_down("left", (_e, cx) => { if (n) this.press(status, cx); })
      .on_mouse_up("left", () => this.release(pick))
      .child(div().child(NAME[status]))
      .child(div().text_size(13).child(String(n)));
    return loud ? halo(color, 13, 5, chip) : div().flex_none().px(5).py(5).child(chip);
  }

  render() {
    const t = theme();
    const m = model();
    const list = m.list;
    const w = win() ?? {};
    const by = (st) => list.filter((a) => a.status === st);
    const wants = sorted(list).filter((a) => CRITICAL.includes(a.status));
    const shown = ORDER.filter((st) => by(st).length > 0 || ["blocked", "done", "working", "idle"].includes(st));
    const total = list.length;
    const ready = m.primaries.length > 0;
    const pressing = wants.length > 0 && ready;
    const nudge = own(h_flex())
      .id("c-nudge")
      .h(26).px(11).gap(6).items_center().rounded(13).cursor_pointer().text_size(11).font_semibold()
      .border_1().border_color(pressing ? t.accent : t.border)
      .when(pressing, (el) => el.bg(t.accent).text_color(ink(t.accent)))
      .when(!pressing, (el) => el.text_color(ready ? t.muted : t.dim).hover((x) => x.bg(t.hover)))
      .tooltip(ready ? `Ask a primary agent to check on its sub-agents (${first("g.nudge")})` : "No primary agent yet: one that has started sub-agents")
      .on_click(() => this.nudge())
      .child("⚑ NUDGE");
    const unreadList = sorted(list).filter((a) => CRITICAL.includes(a.status) && a.unseen);
    const unread = unreadList.length;
    const hot = unread ? colorOf(t, unreadList[0].status) : t.border;
    const inbox = own(h_flex())
      .id("c-inbox")
      .h(26).px(11).gap(6).items_center().rounded(13).cursor_pointer().text_size(11).font_semibold()
      .border_1().border_color(hot)
      .when(unread > 0, (x) => x.bg(hot).text_color(ink(hot)))
      .when(unread === 0, (x) => x.text_color(t.dim).hover((y) => y.bg(t.hover)))
      .tooltip(`Triage: step through the critical unread, on hotkeys (${first("g.inbox")})`)
      .on_click(() => run("mod.open", { name: "conduct-triage" }))
      .child(`INBOX ${unread}`);
    return h_flex()
      .size_full()
      .items_center()
      .gap(2)
      .pl(12)
      .bg(t.chrome)
      .border_b(1)
      .border_color(wants.length ? t.blocked : t.border)
      .when(w.platform === "macos" && w.titlebar === "none" && !w.fullscreen, (el) => el.pl(72))
      .child(div().flex_none().text_size(11).font_semibold().text_color(t.dim).pr(6).child(`${total}`))
      .child(
        h_flex().id("c-counts").flex_shrink(1).min_w(0).items_center().gap(2).overflow_x_scrollbar()
          .children(shown.map((st) => this.count(t, st, by(st).length, list))),
      )
      .child(div().flex_1().min_w(0).h_full())
      .child(div().flex_none().mr(8).child(unread ? halo(hot, 13, 4, inbox) : inbox))
      .child(div().flex_none().mr(6).child(pressing ? halo(t.accent, 13, 4, nudge) : nudge))
      .child(this.button(t, "c-new", "plus", () => run("tab.new")))
      .child(this.button(t, "c-settings", "gear", () => run("mod.open", { name: "conduct-settings" })))
      .when(Boolean(w.buttons), (el) =>
        el.child(
          h_flex().flex_none().px(6).gap(2)
            .child(this.button(t, "c-min", "win-min", () => run("window.minimize")))
            .child(this.button(t, "c-max", w.maximized ? "win-restore" : "win-max", () => run("window.maximize")))
            .child(this.button(t, "c-close", "win-close", () => run("window.close"), true)),
        ),
      );
  }
}
