// Dungeon Crawler Carl layout: the top bar. Floors (spaces) on the left,
// rooms (tabs) beside them, the System's controls on the right.

import { View, div, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { spaces, run, theme, openOverlay, window as win } from "herdr";
import { floorOf, themeFor } from "./floors.js";

function own(el) {
  return el.on_mouse_down("left", (_e, cx) => cx.stop_propagation()).on_mouse_down("right", (_e, cx) => cx.stop_propagation());
}

export default class DccBar extends View {
  button(t, id, icon, onClick, danger) {
    return own(div())
      .id(id)
      .flex_none()
      .p(7)
      .rounded(3)
      .text_color(t.dim)
      .cursor_pointer()
      .hover((s) => s.bg(danger ? t.solid : t.raised).text_color(danger ? t.solid_foreground : t.accent))
      .on_click(onClick)
      .child(svg(`mods/dcc-bar/${icon}.svg`).size(15));
  }

  render(cx) {
    const t = theme();
    const all = spaces();
    const space = all.find((s) => s.active);
    if (!space) return div();
    const w = win() ?? {};
    const fl = floorOf(space);
    const floor = String(fl.n).padStart(2, "0");

    // The whole window takes on the shown floor's look (themes/dungeon-fN.json).
    if (this.applied !== fl.n) {
      this.applied = fl.n;
      cx.spawn(async () => { run("app.theme", { name: themeFor(fl) }); });
    }

    const tab = (c) => {
      const dot = c.status && c.status !== "idle" ? t[c.status] : null;
      return own(h_flex())
        .id(`dcc-tab-${c.id}`)
        .flex_shrink(1)
        .min_w(0)
        .max_w(220)
        .h_full()
        .px(12)
        .gap(8)
        .items_center()
        .cursor_pointer()
        .text_size(12)
        .border_b(2)
        .border_color(c.active ? t.accent : "#00000000")
        .when(c.active, (el) => el.bg(t.surface).text_color(t.accent))
        .when(!c.active, (el) => el.text_color(t.muted).hover((s) => s.bg(t.hover)))
        .on_click(() => run("tab.select", { id: c.id }))
        .on_mouse_down("right", () =>
          openOverlay({ mod: "menu", kind: "popup", width: 200, props: { tab: "tab", target: { id: c.id, space: space.id } } }),
        )
        .child(div().flex_none().text_color(t.dim).child(`R${c.index}`))
        .child(div().truncate().child(c.name))
        .when(Boolean(dot), (el) => el.child(div().flex_none().size(7).rounded_full().bg(dot).loop("opacity", { from: 0.35, to: 1, period: 1100 })));
    };

    return h_flex()
      .size_full()
      .items_center()
      .gap(6)
      .bg(t.chrome)
      .border_b(1)
      .border_color(t.border)
      .when(w.platform === "macos" && w.titlebar === "none" && !w.fullscreen, (el) => el.pl(72))
      .pl(12)
      .child(svg("mods/dcc-bar/skull.svg").size(20).flex_none().text_color(t.blocked))
      .child(div().flex_none().text_size(12).font_semibold().text_color(t.accent).child("DUNGEON CRAWL"))
      .child(
        own(h_flex())
          .id("dcc-floor")
          .flex_none()
          .h(26)
          .px(10)
          .ml(8)
          .gap(8)
          .items_center()
          .rounded(3)
          .border_1()
          .border_color(t.border)
          .bg(t.surface)
          .cursor_pointer()
          .text_size(12)
          .hover((s) => s.border_color(t.accent))
          .tooltip("Choose this space's floor")
          .on_click(() => openOverlay({ mod: "dcc-floors", kind: "dialog", width: 1000, height: 760, props: { space: space.id } }))
          .child(div().text_color(t.accent).font_semibold().child(`FLOOR ${floor}`))
          .child(div().max_w(140).truncate().text_color(t.muted).child(fl.name))
          .child(
            div().id("dcc-space-name").max_w(160).truncate().pl(8).border_l(1).border_color(t.border).text_color(t.foreground)
              .tooltip("Switch space")
              .on_click((_e, cx) => { cx.stop_propagation(); openOverlay({ mod: "picker", kind: "popup", at: "top", offset: 44, width: 640, height: 0.8 }); })
              .child(space.name),
          ),
      )
      .child(h_flex().flex_shrink(1).min_w(0).h_full().ml(8).children(space.tabs.map(tab)))
      .child(div().flex_1())
      .child(this.button(t, "dcc-new", "plus", () => run("tab.new", { space: space.id })))
      .child(this.button(t, "dcc-keys", "command", () => run("app.palette")))
      .when(Boolean(w.buttons), (el) =>
        el.child(
          h_flex()
            .flex_none()
            .px(6)
            .gap(2)
            .child(this.button(t, "dcc-min", "win-min", () => run("window.minimize")))
            .child(this.button(t, "dcc-max", w.maximized ? "win-restore" : "win-max", () => run("window.maximize")))
            .child(this.button(t, "dcc-close", "win-close", () => run("window.close"), true)),
        ),
      );
  }
}
