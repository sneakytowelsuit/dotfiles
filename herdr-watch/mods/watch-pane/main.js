// Watch layout: pane header. A status stripe across the top, and a filled, pulsing tag when
// this terminal needs you, so a glance at the grid shows which pane is calling.

import { View, div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { panes, agents, props, theme } from "herdr";
import { NAME, needs, colorOf, ink } from "./attn.js";

export default class WatchPane extends View {
  render() {
    const t = theme();
    const p = panes().find((x) => x.pane === props()?.pane);
    if (!p) return div();
    const ag = agents().find((x) => x.pane === p.pane);
    const st = p.status ?? ag?.status ?? null;
    const color = st ? colorOf(t, st) : t.dim;
    const loud = st === "blocked" || st === "done";
    const name = ag?.title || p.title || p.program?.name || "shell";
    return h_flex()
      .id(`w-ph-${p.pane}`)
      .relative()
      .size_full()
      .px(10).gap(8).items_center().text_size(11)
      .bg(loud ? color + "22" : t.surface)
      .border_b(1).border_color(p.focused ? t.accent : loud ? color : t.border)
      .child(
        div().absolute().left(0).top(0).w_full().h(3).bg(st ? color : "#00000000")
          .when(loud, (d) => d.loop("opacity", { from: 0.35, to: 1, period: 1000 })),
      )
      .child(div().flex_1().truncate().font_semibold().text_color(p.focused ? t.accent : t.foreground).child(name))
      .child(div().truncate().max_w(260).text_color(t.dim).child(p.branch ? `⎇ ${p.branch}` : ""))
      .when(Boolean(st && st !== "idle"), (el) =>
        el.child(
          div().flex_none().h(18).px(8).flex().items_center().rounded(9).text_size(10).font_semibold()
            .border_1().border_color(color)
            .when(loud, (d) => d.bg(color).text_color(ink(color)).loop("opacity", { from: 0.6, to: 1, period: 1000 }))
            .when(!loud, (d) => d.text_color(color))
            .child(NAME[st]),
        ),
      );
  }
}
