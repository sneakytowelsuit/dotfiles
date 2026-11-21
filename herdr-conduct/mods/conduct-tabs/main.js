// Conduct layout: the tab row. The shown space's tabs, each with a dot for the most urgent state of the agents in
// it (filled and pulsing only for blocked, error and stuck), a badge with how many need you, and a + for a new tab.
// Click selects, right-click opens Herdr's tab menu (rename, close, ...). Scrolls sideways if there are many.

import { View, div, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { spaces, run, theme, openOverlay } from "herdr";
import { colorOf, ink, needs, sorted, model } from "./attn.js";

function own(el) {
  return el.on_mouse_down("left", (_e, cx) => cx.stop_propagation()).on_mouse_down("right", (_e, cx) => cx.stop_propagation());
}

export default class ConductTabs extends View {
  init(_p, cx) { cx.timer.every(15000, (cx) => cx.notify()); }

  tab(t, c, space, agents) {
    const worst = sorted(agents)[0];
    const st = worst?.status;
    const color = st ? colorOf(t, st) : t.dim;
    const loud = worst ? needs(worst) : false;
    const nNeed = agents.filter(needs).length;
    // An unnamed tab is called by its first agent's title, which says more than "2".
    const label = c.named ? c.name : agents[0]?.title ?? c.name;
    return own(h_flex())
      .id(`c-tab-${c.id}`)
      .flex_none().max_w(240).h_full().px(12).gap(8).items_center().cursor_pointer().text_size(12)
      .border_b(2).border_color(c.active ? t.accent : "#00000000")
      .when(c.active, (el) => el.bg(t.surface).text_color(t.foreground))
      .when(!c.active, (el) => el.text_color(t.muted).hover((x) => x.bg(t.hover)))
      .tooltip(agents.length ? `${label}: ${agents.length} agent${agents.length === 1 ? "" : "s"}${nNeed ? `, ${nNeed} need you` : ""}` : label)
      .on_click(() => run("tab.select", { id: c.id }))
      .on_mouse_down("right", () => openOverlay({ mod: "menu", kind: "popup", width: 200, props: { tab: "tab", target: { id: c.id, space: space.id } } }))
      .when(label !== String(c.index), (el) => el.child(div().flex_none().text_size(10).text_color(t.dim).child(String(c.index))))
      .child(div().min_w(0).truncate().font_semibold().when(!c.active, (d) => d.font_normal()).child(label))
      .when(Boolean(st && st !== "idle"), (el) =>
        el.child(
          div().flex_none().size(8).rounded_full().border_1().border_color(color)
            .when(loud, (d) => d.bg(color).loop("opacity", { from: 0.35, to: 1, period: 1000 }))
            .when(!loud && st === "working", (d) => d.bg(color).loop("opacity", { from: 0.4, to: 1, period: 1400 })),
        ))
      .when(nNeed > 0, (el) => el.child(div().flex_none().h(16).px(6).flex().items_center().rounded(8).bg(color).text_color(ink(color)).text_size(10).font_semibold().child(String(nNeed))));
  }

  render() {
    const t = theme();
    const space = spaces().find((s) => s.active);
    if (!space) return div();
    const m = model();
    const byTab = new Map();
    for (const n of m.list) if (n.tab) byTab.set(n.tab, [...(byTab.get(n.tab) ?? []), n]);
    return h_flex()
      .size_full().items_center().pl(8).gap(2)
      .bg(t.chrome).border_b(1).border_color(t.border)
      .child(
        h_flex().id("c-tabs-scroll").flex_shrink(1).min_w(0).h_full().items_center().overflow_x_scrollbar()
          .children(space.tabs.map((c) => this.tab(t, c, space, byTab.get(c.id) ?? []))),
      )
      .child(
        own(div()).id("c-tabs-new").flex_none().p(7).rounded(3).text_color(t.dim).cursor_pointer()
          .hover((x) => x.bg(t.raised).text_color(t.accent))
          .tooltip("New tab")
          .on_click(() => run("tab.new", { space: space.id }))
          .child(svg("mods/conduct-tabs/plus.svg").size(15)),
      );
  }
}
