// Dungeon Crawler Carl layout: the left sidebar. Spaces are floors of the
// dungeon; agents are the crawlers (and their status is their health).

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { spaces, agents, run, theme, setAgentOrder, openOverlay } from "herdr";
import { who } from "./cast.js";
import { avatar } from "./avatar.js";
import { floorOf } from "./floors.js";

const floorNum = (id) => { const s = spaces().find((x) => x.id === id); return s ? floorOf(s).n : 0; };

const LABEL = {
  working: "IN COMBAT",
  blocked: "AWAITS YOUR INPUT",
  done: "ACHIEVEMENT UNLOCKED",
  idle: "RESTING IN SAFE ROOM",
};
// How full a crawler's "health bar" looks, by what it's up to.
const BAR = { working: 0.62, blocked: 0.28, done: 1, idle: 0.85 };

function header(t, icon, label, right) {
  return h_flex()
    .flex_none()
    .px(12)
    .pt(12)
    .pb(6)
    .gap(8)
    .items_center()
    .child(svg(`mods/dcc-crawlers/${icon}.svg`).size(14).text_color(t.accent))
    .child(div().flex_1().text_size(11).font_semibold().text_color(t.accent).child(label))
    .child(right ?? div());
}

export default class DccCrawlers extends View {
  floor(t, s) {
    const dot = s.status && s.status !== "idle" ? t[s.status] : null;
    return h_flex()
      .id(`dcc-f-${s.id}`)
      .mx(6)
      .px(8)
      .py(6)
      .gap(10)
      .items_center()
      .rounded(3)
      .cursor_pointer()
      .border_l(2)
      .border_color(s.active ? t.accent : "#00000000")
      .when(s.active, (el) => el.bg(t.raised))
      .when(!s.active, (el) => el.hover((x) => x.bg(t.hover)))
      .on_click(() => run("space.select", { id: s.id }))
      .on_mouse_down("right", () =>
        openOverlay({ mod: "menu", kind: "popup", width: 200, height: 260, props: { tab: "space", target: { id: s.id } } }),
      )
      .child(div().id(`dcc-fb-${s.id}`).flex_none().w(26).text_size(12).font_semibold().text_color(s.active ? t.accent : t.dim).cursor_pointer().tooltip("Choose floor").hover((x) => x.text_color(t.accent)).on_click((_e, cx) => { cx.stop_propagation(); openOverlay({ mod: "dcc-floors", kind: "dialog", width: 1000, height: 760, props: { space: s.id } }); }).child(String(floorOf(s).n).padStart(2, "0")))
      .child(
        v_flex()
          .flex_1()
          .min_w(0)
          .child(div().truncate().text_size(13).text_color(s.active ? t.foreground : t.muted).child(s.name))
          .when(Boolean(s.branch), (el) => el.child(div().truncate().text_size(10).text_color(t.dim).child(`⎇ ${s.branch}`))),
      )
      .when(Boolean(dot), (el) => el.child(div().flex_none().size(7).rounded_full().bg(dot).loop("opacity", { from: 0.35, to: 1, period: 1100 })));
  }

  crawler(t, a) {
    const color = a.status === "idle" ? t.idle : t[a.status] ?? t.idle;
    const g = a.program;
    const c = who(a.address);
    return v_flex()
      .id(`dcc-c-${a.address}`)
      .mx(6)
      .px(10)
      .py(8)
      .gap(5)
      .rounded(3)
      .border_1()
      .border_color(a.focused ? t.accent : t.border)
      .bg(t.surface)
      .cursor_pointer()
      .hover((s) => s.border_color(color))
      .on_click(() => run("pane.focus", { pane: a.pane }))
      .child(
        h_flex()
          .gap(9)
          .items_center()
          .child(
            div().id(`dcc-av-${a.address}`).flex_none().cursor_pointer().tooltip("Choose character")
              .on_click((_e, cx) => { cx.stop_propagation(); openOverlay({ mod: "dcc-cast", kind: "dialog", width: 1000, height: 520, props: { address: a.address } }); })
              .child(avatar(t, a.status, c)),
          )
          .child(
            v_flex().flex_1().min_w(0)
              .child(div().truncate().text_size(13).font_semibold().text_color(t.foreground).child(c.name + (a.pinned ? " ★" : "")))
              .child(div().truncate().text_size(10).text_color(t.dim).child(`${g?.name ?? a.app ?? "crawler"} · ${c.role}`)),
          )
          .child(
            a.status === "working"
              ? svg("mods/dcc-crawlers/spinner.svg").size(12).flex_none().text_color(color).spin(900)
              : div().flex_none().size(8).rounded_full().bg(color),
          )
          .child(div().flex_none().text_size(10).text_color(t.dim).child(`F${String(floorNum(a.space)).padStart(2, "0")}`)),
      )
      .child(div().text_size(11).text_color(c.color).child(`"${c.say[a.status] ?? ""}"`))
      .child(div().truncate().text_size(10).text_color(t.muted).child(a.title || a.space_name))
      // The "health bar": it pulses while in combat, and drains to red when the crawler needs you.
      .child(
        div().h(4).rounded(2).bg(t.border).overflow_hidden().child(
          div().h_full().w(`${Math.round(BAR[a.status] * 100)}%`).rounded(2).bg(color)
            .when(a.status === "working" || a.status === "blocked", (el) => el.loop("opacity", { from: 0.5, to: 1, period: 1200 })),
        ),
      )
      .child(div().text_size(9).font_semibold().text_color(color).child(LABEL[a.status] ?? ""));
  }

  render() {
    const t = theme();
    const all = spaces();
    const list = agents();
    setAgentOrder(list.map((a) => a.address));
    return v_flex()
      .id("dcc-side")
      .size_full()
      .bg(t.chrome)
      .child(
        header(
          t,
          "stairs",
          "FLOORS",
          div().id("dcc-new-floor").flex_none().px(6).rounded(3).text_size(14).text_color(t.dim).cursor_pointer()
            .hover((s) => s.bg(t.raised).text_color(t.accent))
            .on_click(() => run("space.new"))
            .child("+"),
        ),
      )
      .child(v_flex().flex_none().h(Math.min(260, all.length * 52)).overflow_y_scrollbar().gap(1).children(all.map((s) => this.floor(t, s))))
      .child(header(t, "skull", `CRAWLERS (${list.length})`))
      .child(
        v_flex().flex_1().min_h(0).overflow_y_scrollbar().gap(6).pb(8).children(
          list.length
            ? list.map((a) => this.crawler(t, a))
            : [div().px(14).py(6).text_size(11).text_color(t.dim).child("No crawlers yet. The floor is eerily quiet.")],
        ),
      );
  }
}
