// Conduct layout: pane header. A status stripe across the top and a filled, pulsing tag with how long
// the terminal has been in that state, so a glance at the grid shows which pane is calling.

import { View, div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { panes, props, theme } from "herdr";
import { NAME, needs, colorOf, ink, model, age } from "./attn.js";
import { readUsage } from "./usage-poll.js";
import { stateIcon } from "./glyphs.js";
import { contextBar, cacheTimer } from "./health.js";

export default class ConductPane extends View {
  init(_p, cx) { cx.timer.every(2000, (cx) => cx.notify()); } // seconds countdown on the cache timer

  render() {
    const t = theme();
    const p = panes().find((x) => x.pane === props()?.pane);
    if (!p) return div();
    const a = p.terminal ? model().nodes.get(p.terminal) : null;
    const st = a?.status ?? null;
    const color = st ? colorOf(t, st) : t.dim;
    const loud = a ? needs(a) : false;
    const name = a?.title || p.title || p.program?.name || "shell";
    const subs = a?.children.length ?? 0;
    const u = a ? readUsage(a.address) : null;
    return h_flex()
      .id(`c-ph-${p.pane}`)
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
      .when(subs > 0, (el) => el.child(div().flex_none().text_color(t.dim).child(`★ ${subs} sub-agent${subs === 1 ? "" : "s"}`)))
      .child(div().truncate().max_w(220).text_color(t.dim).child(p.branch ? `⎇ ${p.branch}` : ""))
      .when(Boolean(u?.ctx), (el) => el.child(div().flex_none().w(250).child(contextBar(t, u, { width: 250, height: 5, label: true }))))
      .when(Boolean(u), (el) => el.child(div().flex_none().w(190).child(cacheTimer(t, u, { width: 190, height: 4, hot: st === "working" }))))
      .when(Boolean(st && st !== "idle"), (el) =>
        el.child(
          div().flex_none().h(18).px(8).flex().items_center().gap(6).rounded(9).text_size(10).font_semibold()
            .border_1().border_color(color)
            .when(loud, (d) => d.bg(color).text_color(ink(color)).loop("opacity", { from: 0.6, to: 1, period: 1000 }))
            .when(!loud, (d) => d.text_color(color))
            .child(stateIcon(t, st, 12).flex_none().when(loud, (d) => d.text_color(ink(color))))
            .child(`${NAME[st]}${a?.since ? ` ${age(a.since)}` : ""}`),
        ),
      );
  }
}
