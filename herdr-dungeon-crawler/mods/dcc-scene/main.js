// Dungeon Crawler Carl layout: the banner over the sidebar. An animated scene for the shown
// space's floor, with its name. Click it to pick a different floor for this space.

import { View, div } from "gpui-kit";
import { v_flex } from "gpui-base";
import { spaces, openOverlay, theme } from "herdr";
import { floorOf } from "./floors.js";
import { scene } from "./scene.js";

export default class DccScene extends View {
  init() { this.w = 270; }

  render() {
    const t = theme();
    const space = spaces().find((s) => s.active);
    if (!space) return div();
    const fl = floorOf(space);
    const h = 92;
    return div()
      .id("dcc-scene")
      .relative()
      .size_full()
      .overflow_hidden()
      .cursor_pointer()
      .on_size_change((s, cx) => { if (Math.abs(s.width - this.w) > 1) { this.w = s.width; cx.notify(); } })
      .on_click(() => openOverlay({ mod: "dcc-floors", kind: "dialog", width: 1000, height: 650, props: { space: space.id } }))
      .child(scene(fl.n, Math.round(this.w), h))
      .child(
        v_flex().absolute().left(0).top(h - 34).w(Math.round(this.w)).h(34).px(10).justify_center().bg("#000000b0")
          .child(div().truncate().text_size(11).font_semibold().text_color(t.accent).child(`FLOOR ${String(fl.n).padStart(2, "0")} · ${fl.name.toUpperCase()}`))
          .child(div().truncate().text_size(9).text_color(t.muted).child(fl.tag)),
      );
  }
}
