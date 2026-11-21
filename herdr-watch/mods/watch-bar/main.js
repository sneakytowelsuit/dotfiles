// Watch layout: the top bar is an agent monitor. One chip per status with its count: outlined when
// nothing needs you, filled with a pulsing halo when something does (blocked, done and unseen).
// Below the counts, a chip per agent that needs you; click one to land in its terminal.

import { View, div, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { agents, spaces, run, theme, window as win, nextCommand, openOverlay } from "herdr";
import { ORDER, NAME, needs, sorted, colorOf, ink, go, halo, nextNeeding } from "./attn.js";

function own(el) {
  return el.on_mouse_down("left", (_e, cx) => cx.stop_propagation()).on_mouse_down("right", (_e, cx) => cx.stop_propagation());
}

export default class WatchBar extends View {
  init(_p, cx) {
    // alt-n / alt-p (keys.json: "watch-bar.next" / "watch-bar.prev") jump through what needs you.
    cx.spawn(async () => {
      for (;;) {
        const c = await nextCommand();
        const a = nextNeeding(agents(), c === "prev" ? -1 : 1);
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
      openOverlay({ mod: "watch-menu", kind: "popup", at: "pointer", width: 340, props: { status } });
    });
  }

  release(pick) {
    this.hold++;
    if (this.held) { this.held = false; return; }
    pick();
  }

  button(t, id, icon, onClick, danger) {
    return own(div())
      .id(id).flex_none().p(7).rounded(3).text_color(t.dim).cursor_pointer()
      .hover((s) => s.bg(danger ? t.solid : t.raised).text_color(danger ? t.solid_foreground : t.accent))
      .on_click(onClick)
      .child(svg(`mods/watch-bar/${icon}.svg`).size(15));
  }

  // A status counter. Attention statuses with agents are filled and haloed; the rest are outlines.
  count(t, status, n, list) {
    const color = colorOf(t, status);
    const loud = (status === "blocked" || status === "done") && n > 0;
    const pick = () => {
      const q = list.filter((a) => a.status === status);
      if (!q.length) return;
      // Repeat clicks walk through the agents in that state.
      const k = (this.i[status] = ((this.i[status] ?? -1) + 1) % q.length);
      go(q[k]);
    };
    const chip = own(h_flex())
      .id(`w-c-${status}`)
      .h(26).px(10).gap(7).items_center().rounded(13).cursor_pointer().text_size(11).font_semibold()
      .border_1().border_color(n > 0 ? color : t.border)
      .when(loud, (el) => el.bg(color).text_color(ink(color)))
      .when(!loud, (el) => el.text_color(n > 0 ? color : t.dim).hover((s) => s.bg(t.hover)))
      .tooltip(n ? `${NAME[status]}: ${n}. Click: next one. Hold: choose.` : `${NAME[status]}: none`)
      .on_mouse_down("left", (_e, cx) => { if (n) this.press(status, cx); })
      .on_mouse_up("left", () => this.release(pick))
      .child(div().child(NAME[status]))
      .child(div().text_size(13).child(String(n)));
    return loud ? halo(color, 13, 5, chip) : div().flex_none().px(5).py(5).child(chip);
  }

  // One agent that needs you.
  who(t, a) {
    const color = colorOf(t, a.status);
    const label = a.title || a.program?.name || "agent";
    const chip = own(h_flex())
      .id(`w-a-${a.address}`)
      .h(24).px(9).gap(6).items_center().rounded(12).cursor_pointer().text_size(11)
      .bg(color).text_color(ink(color))
      .tooltip(`${NAME[a.status]}: ${a.space_name} / ${a.tab_name}`)
      .on_click(() => go(a))
      .child(div().max_w(150).truncate().font_semibold().child(label))
      .child(div().max_w(90).truncate().opacity(0.75).child(a.space_name));
    return halo(color, 12, 4, chip);
  }

  render() {
    const t = theme();
    const list = agents();
    const w = win() ?? {};
    const by = (s) => list.filter((a) => a.status === s);
    const wants = sorted(list).filter(needs);
    const total = list.length;
    return h_flex()
      .size_full()
      .items_center()
      .gap(4)
      .pl(12)
      .bg(t.chrome)
      .border_b(1)
      .border_color(wants.length ? t.blocked : t.border)
      .when(w.platform === "macos" && w.titlebar === "none" && !w.fullscreen, (el) => el.pl(72))
      .child(div().flex_none().text_size(11).font_semibold().text_color(t.dim).pr(6).child(`${total} AGENT${total === 1 ? "" : "S"}`))
      .children(ORDER.map((s) => this.count(t, s, by(s).length, list)))
      .child(div().flex_none().w(1).h(20).mx(8).bg(t.border))
      .child(
        wants.length
          ? h_flex().flex_shrink(1).min_w(0).overflow_hidden().gap(2).items_center().children(wants.slice(0, 5).map((a) => this.who(t, a)))
              .when(wants.length > 5, (el) => el.child(div().flex_none().px(6).text_size(11).text_color(t.muted).child(`+${wants.length - 5}`)))
          : div().text_size(11).text_color(t.dim).child("Nothing needs you."),
      )
      .child(div().flex_1().h_full())
      .child(div().flex_none().text_size(10).text_color(t.dim).px(8).child("alt-n next · alt-p prev"))
      .child(this.button(t, "w-new", "plus", () => run("tab.new")))
      .when(Boolean(w.buttons), (el) =>
        el.child(
          h_flex().flex_none().px(6).gap(2)
            .child(this.button(t, "w-min", "win-min", () => run("window.minimize")))
            .child(this.button(t, "w-max", w.maximized ? "win-restore" : "win-max", () => run("window.maximize")))
            .child(this.button(t, "w-close", "win-close", () => run("window.close"), true)),
        ),
      );
  }
}
