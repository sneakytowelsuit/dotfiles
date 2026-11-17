// Dungeon Crawler Carl layout: a pane header, styled as a mob's nameplate.

import { View, div, svg, image } from "gpui-kit";
import { h_flex } from "gpui-base";
import { panes, agents, props, run, theme, home } from "herdr";
import { who } from "./cast.js";
import { avatar } from "./avatar.js";

const TAG = { working: "IN COMBAT", blocked: "YOUR MOVE, CRAWLER", done: "ACHIEVEMENT!", idle: null };

function folder(cwd) {
  if (!cwd) return "";
  const h = home();
  return cwd === h ? "~" : cwd.startsWith(h + "/") ? "~" + cwd.slice(h.length) : cwd;
}

export default class DccPane extends View {
  init() { this.hovered = false; }

  button(t, id, icon, command, args) {
    return div()
      .id(id)
      .p(3)
      .rounded(3)
      .text_color(t.dim)
      .hover((s) => s.bg(t.raised).text_color(t.accent))
      .on_click((_e, cx) => {
        cx.stop_propagation();
        run(command, args);
      })
      .child(svg(`mods/dcc-pane/${icon}.svg`).size(14));
  }

  render() {
    const t = theme();
    const p = panes().find((x) => x.pane === props()?.pane);
    if (!p) return div();
    const pane = p.pane;
    const g = p.program;
    const ag = agents().find((x) => x.pane === p.pane);
    const c = ag ? who(ag.address) : null;
    const name = c ? c.name : ((g?.agent || g?.shell) && g.name) || p.title || g?.name || "shell";
    const st = p.status;
    const color = st && st !== "idle" ? t[st] : t.dim;
    return h_flex()
      .id(`dcc-ph-${pane}`)
      .size_full()
      .px(10)
      .gap(8)
      .items_center()
      .bg(t.surface)
      .border_b(1)
      .border_color(p.focused ? t.accent : t.border)
      .text_size(11)
      .on_hover((h, cx) => { this.hovered = h; cx.notify(); })
      .on_click(() => run("pane.focus", { pane }))
      .child(div().flex_none().w(3).h(14).rounded(1).bg(color))
      .when(Boolean(c), (el) => el.child(avatar(t, p.status ?? ag.status, c, 30)))
      .when(!c && Boolean(g?.icon), (el) => el.child(g.tint ? svg(g.icon).size(13).flex_none().text_color(t.muted) : image(g.icon).w(13).h(13).flex_none()))
      .child(div().flex_none().truncate().max_w(240).font_semibold().text_color(p.focused ? t.accent : t.foreground).child(name))
      .child(div().flex_1().truncate().text_color(t.dim).child((c ? `${g?.name ?? "agent"} · ` : "") + folder(p.cwd) + (p.branch ? `  ⎇ ${p.branch}` : "")))
      .when(Boolean(st && TAG[st]), (el) =>
        el.child(
          div().flex_none().px(6).h(16).flex().items_center().rounded(2).bg(color + "26").border_1().border_color(color + "66")
            .text_size(10).font_semibold().text_color(color)
            .when(st === "blocked" || st === "working", (d) => d.loop("opacity", { from: 0.55, to: 1, period: 1300 }))
            .child(TAG[st]),
        ),
      )
      .when(this.hovered, (el) =>
        el
          .child(this.button(t, `dcc-r-${pane}`, "split-right", "pane.split", { direction: "right", pane }))
          .child(this.button(t, `dcc-d-${pane}`, "split-down", "pane.split", { direction: "down", pane }))
          .child(this.button(t, `dcc-z-${pane}`, p.zoomed ? "unzoom" : "zoom", "pane.zoom", { pane }))
          .child(this.button(t, `dcc-x-${pane}`, "close", "pane.close", { pane })),
      );
  }
}
