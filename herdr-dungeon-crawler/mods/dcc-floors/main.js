// Dungeon Crawler Carl layout: choose which floor of the World Dungeon a space is on.
// Props: { space, overlay }. The choice is kept in shared state ("dcc.floors") and themes the window.

import { View, div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { props, closeOverlay, spaces, theme } from "herdr";
import { FLOORS, MAX, floorOf, setFloor, isPicked } from "./floors.js";
import { scene } from "./scene.js";

const CARD_W = 232;
const SCENE_H = 76;

export default class DccFloors extends View {
  card(t, fl, current, spaceId, overlay) {
    const on = fl.n === current.n;
    return v_flex()
      .id(`dcc-pick-${fl.n}`)
      .flex_none()
      .w(CARD_W)
      .rounded(4)
      .overflow_hidden()
      .border_1()
      .border_color(on ? t.accent : t.border)
      .bg(t.surface)
      .cursor_pointer()
      .hover((s) => s.border_color(t.accent))
      .on_click(() => { setFloor(spaceId, fl.n); closeOverlay(overlay); })
      .child(scene(fl.n, CARD_W - 2, SCENE_H))
      .child(
        v_flex().px(10).py(7).gap(2).h(92)
          .child(h_flex().gap(8).items_center()
            .child(div().flex_none().text_size(11).font_semibold().text_color(t.accent).child(`FLOOR ${String(fl.n).padStart(2, "0")}`))
            .child(div().flex_1().truncate().text_size(12).font_semibold().text_color(t.foreground).child(fl.name))
            .when(on, (el) => el.child(div().flex_none().text_size(9).font_semibold().text_color(t.accent_foreground).px(5).rounded(2).bg(t.accent).child("HERE"))))
          .child(div().truncate().text_size(9).text_color(t.dim).child(fl.book))
          .child(div().text_size(10).text_color(t.muted).max_h(38).overflow_hidden().child(fl.tag)),
      );
  }

  render() {
    const t = theme();
    const p = props() ?? {};
    const space = spaces().find((s) => s.id === p.space) ?? spaces().find((s) => s.active);
    if (!space) return div();
    const current = floorOf(space);
    const rows = [];
    for (let i = 0; i < MAX; i += 4) rows.push(FLOORS.slice(i, i + 4));
    return v_flex()
      .id("dcc-floors")
      .size_full()
      .bg(t.popover)
      .p(16)
      .gap(12)
      .child(
        h_flex().flex_none().items_center().gap(10)
          .child(div().flex_1().min_w(0).child(
            v_flex().gap(2)
              .child(div().text_size(13).font_semibold().text_color(t.accent).child("CHOOSE A FLOOR"))
              .child(div().truncate().text_size(11).text_color(t.muted).child(`for ${space.name}. The whole window takes on its look.`))))
          .when(isPicked(space), (el) => el.child(
            div().id("dcc-pick-reset").flex_none().px(10).py(5).rounded(3).border_1().border_color(t.border).text_size(11).text_color(t.muted).cursor_pointer()
              .hover((s) => s.border_color(t.accent).text_color(t.foreground))
              .on_click(() => { setFloor(space.id, null); closeOverlay(p.overlay); })
              .child("Back to default"))),
      )
      .children(rows.map((row) => h_flex().flex_none().gap(12).children(row.map((fl) => this.card(t, fl, current, space.id, p.overlay)))));
  }
}
