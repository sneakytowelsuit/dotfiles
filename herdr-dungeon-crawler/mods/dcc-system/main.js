// Dungeon Crawler Carl layout: the System AI. Watches the crawlers (agents)
// and announces what they do, in its own deeply unhelpful voice.

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { agents, spaces, theme } from "herdr";
import { floorOf } from "./floors.js";
import { who, sprite } from "./cast.js";
import { image } from "gpui-kit";

const MAX = 40;

const pick = (arr, n) => arr[n % arr.length];

const LINES = {
  arrive: (c, n) => pick([
    `New crawler detected: ${c}. Please sign the waiver.`,
    `${c} has entered the dungeon. Survival odds have been updated. Downward.`,
  ], n),
  working: (c, n) => pick([
    `${c} has engaged a task. The System is taking bets.`,
    `Combat initiated by ${c}. Viewers are tuning in.`,
  ], n),
  blocked: (c, n) => pick([
    `${c} requires your input. The System finds this adorable.`,
    `Attention, crawler: ${c} is waiting. Loot boxes do not open themselves.`,
  ], n),
  done: (c, n) => pick([
    `Achievement unlocked: ${c} finished something! Reward: a Bronze Loot Box.`,
    `${c} has completed the encounter. Contents of loot box: unclear. Do not shake.`,
  ], n),
  gone: (c) => `${c} has left the dungeon. The System regrets nothing.`,
};

function stamp() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default class DccSystem extends View {
  init() {
    this.prev = null; // address -> status, null until the first render
    this.log = [{ at: stamp(), text: "Welcome to the Dungeon. The System is monitoring your performance.", color: null }];
    this.n = 0;
  }

  say(text, c) {
    this.log.unshift({ at: stamp(), text, color: c?.color ?? null, face: c ? sprite(c) : null });
    if (this.log.length > MAX) this.log.length = MAX;
  }

  watch(list) {
    const now = new Map(list.map((a) => [a.address, a]));
    if (this.prev) {
      for (const [addr, a] of now) {
        const c = who(addr);
        const before = this.prev.get(addr);
        if (before === undefined) this.say(LINES.arrive(c.name, this.n++), c);
        else if (before !== a.status && LINES[a.status]) this.say(LINES[a.status](c.name, this.n++), c);
      }
      for (const addr of this.prev.keys()) if (!now.has(addr)) this.say(LINES.gone(who(addr).name), who(addr));
    }
    this.prev = new Map([...now].map(([k, a]) => [k, a.status]));
  }

  render() {
    const t = theme();
    this.watch(agents());
    const sp = spaces().find((s) => s.active);
    if (sp) {
      const fl = floorOf(sp);
      if (this.lastFloor !== undefined && this.lastFloor !== fl.n) this.say(fl.arrive, null);
      this.lastFloor = fl.n;
    }
    return v_flex()
      .id("dcc-sys")
      .size_full()
      .bg(t.chrome)
      .border_t(1)
      .border_color(t.border)
      .child(
        h_flex().flex_none().px(12).pt(10).pb(6).gap(8).items_center()
          .child(svg("mods/dcc-system/eye.svg").size(15).flex_none().text_color(t.blocked).loop("opacity", { from: 0.5, to: 1, period: 2200 }))
          .child(div().flex_1().text_size(11).font_semibold().text_color(t.accent).child("THE SYSTEM"))
          .child(div().text_size(9).text_color(t.dim).child("AI · ALWAYS WATCHING")),
      )
      .child(
        v_flex().flex_1().min_h(0).overflow_y_scrollbar().px(8).pb(8).gap(6).children(
          this.log.map((m, i) =>
            h_flex()
              .px(8)
              .py(6)
              .gap(8)
              .rounded(3)
              .border_l(2)
              .border_color(m.color ?? t.accent)
              .bg(i === 0 ? t.raised : t.surface)
              .child(m.face ? image(m.face).w(24).h(24).flex_none() : svg("mods/dcc-system/eye.svg").size(20).flex_none().text_color(t.blocked))
              .child(
                v_flex().flex_1().min_w(0).gap(2)
                  .child(div().text_size(9).text_color(t.dim).child(`[${m.at}]`))
                  .child(div().text_size(11).text_color(i === 0 ? t.foreground : t.muted).child(m.text)),
              ),
          ),
        ),
      );
  }
}
