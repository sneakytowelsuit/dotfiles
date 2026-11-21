// Conduct layout: the long-press menu on a status chip. Lists the agents in that state; pick one to go there.

import { View, div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { props, closeOverlay, theme } from "herdr";
import { NAME, colorOf, go, model, age } from "./attn.js";

export default class ConductMenu extends View {
  render() {
    const t = theme();
    const status = props()?.status;
    const color = colorOf(t, status);
    const list = model().list.filter((a) => a.status === status);
    return v_flex()
      .p(6).gap(2)
      .child(div().px(8).py(4).text_size(10).font_semibold().text_color(color).child(`${NAME[status] ?? ""} · ${list.length}`))
      .child(
        v_flex().max_h(420).overflow_y_scrollbar().gap(2).children(
          list.length
            ? list.map((a) =>
                h_flex().id(`c-m-${a.address}`).px(8).py(6).gap(8).items_center().rounded(4).cursor_pointer()
                  .hover((s) => s.bg(t.hover))
                  .on_click(() => { go(a); closeOverlay(props().overlay); })
                  .child(div().flex_none().size(8).rounded_full().bg(color))
                  .child(
                    v_flex().flex_1().min_w(0)
                      .child(div().truncate().text_size(12).font_semibold().text_color(t.foreground).child(a.title))
                      .child(div().truncate().text_size(10).text_color(t.dim).child(`${a.parent ? `↳ ${model().nodes.get(a.parent)?.title ?? ""} · ` : ""}${a.spaceName} / ${a.tabName}`)),
                  )
                  .child(div().flex_none().text_size(10).text_color(t.dim).child(age(a.since))),
              )
            : [div().px(8).py(6).text_size(11).text_color(t.dim).child("None right now.")],
        ),
      );
  }
}
