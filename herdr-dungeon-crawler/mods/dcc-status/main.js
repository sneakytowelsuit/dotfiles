// Dungeon Crawler Carl layout: bottom bar. The System's running commentary.

import { View, div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { spaces, agents, theme } from "herdr";
import { floorOf } from "./floors.js";

const QUIPS = [
  "Welcome to the Dungeon. The System is monitoring your performance.",
  "Reminder: Floor collapse is not a metaphor.",
  "Your viewers are very disappointed in that last commit.",
  "A loot box has been awarded. It is a Platinum. Do not open it near a Pug.",
  "Achievement: Fought the Linter and Lived.",
  "New Quest: Do Not Push To Main. Reward: None. Penalty: Considerable.",
  "Please remember that the System is not your friend.",
  "Princess Donut would like you to know she is a Princess.",
  "Stairwell located. Safe room ahead. Probably.",
  "Warning: Merge conflict detected. It has a lot of teeth.",
  "The Desperado Club is open. Crawlers drink at their own risk.",
  "Buff acquired: Caffeinated (+3 to Stubbornness).",
];

export default class DccStatus extends View {
  init(_p, cx) {
    this.i = Math.floor(Math.random() * QUIPS.length);
    this.started = Date.now();
    cx.timer.every(15000, (cx) => { this.i = (this.i + 1) % QUIPS.length; cx.notify(); });
    cx.timer.every(60000, (cx) => cx.notify());
  }

  render() {
    const t = theme();
    const s = spaces();
    const active = s.find((x) => x.active);
    const list = agents();
    const working = list.filter((a) => a.status === "working").length;
    const blocked = list.filter((a) => a.status === "blocked").length;
    const mins = Math.floor((Date.now() - this.started) / 60000);
    const depth = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
    const stat = (label, value, color) =>
      h_flex().flex_none().gap(5).child(div().text_color(t.dim).child(label)).child(div().font_semibold().text_color(color ?? t.foreground).child(String(value)));
    return h_flex()
      .size_full()
      .px(12)
      .gap(18)
      .items_center()
      .bg(t.chrome)
      .border_t(1)
      .border_color(t.border)
      .text_size(11)
      .child(stat("FLOOR", active ? floorOf(active).n : "-", t.accent))
      .child(stat("FLOORS", s.length))
      .child(stat("CRAWLERS", list.length))
      .child(stat("IN COMBAT", working, working ? t.working : t.dim))
      .child(stat("AWAITING YOU", blocked, blocked ? t.blocked : t.dim))
      .child(div().flex_1().truncate().text_color(t.muted).child(`» ${QUIPS[this.i]}`))
      .child(stat("TIME IN DUNGEON", depth));
  }
}
