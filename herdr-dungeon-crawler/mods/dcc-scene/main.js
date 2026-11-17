// Dungeon Crawler Carl layout: the banner over the sidebar. An animated scene for the shown
// space's floor, and under it the floor's name and description in full. Click it to pick a
// different floor for this space.

import { View, div } from "gpui-kit";
import { v_flex } from "gpui-base";
import { spaces, openOverlay, theme } from "herdr";
import { floorOf } from "./floors.js";
import { scene } from "./scene.js";

const SCENE_H = 80;

export default class DccScene extends View {
  init() { this.w = 270; }

  render() {
    const t = theme();
    const space = spaces().find((s) => s.active);
    if (!space) return div();
    const fl = floorOf(space);
    return v_flex()
      .id("dcc-scene")
      .size_full()
      .overflow_hidden()
      .cursor_pointer()
      .on_size_change((s, cx) => { if (Math.abs(s.width - this.w) > 1) { this.w = s.width; cx.notify(); } })
      .on_click(() => openOverlay({ mod: "dcc-floors", kind: "dialog", width: 1000, height: 760, props: { space: space.id } }))
      .child(scene(fl.n, Math.round(this.w), SCENE_H))
      .child(
        v_flex().flex_1().min_h(0).px(10).py(6).gap(2).bg(t.chrome).overflow_hidden()
          .child(div().text_size(11).font_semibold().text_color(t.accent).child(`FLOOR ${String(fl.n).padStart(2, "0")} · ${fl.name.toUpperCase()}`))
          .child(div().text_size(9).text_color(t.muted).child(fl.tag)),
      );
  }
}
