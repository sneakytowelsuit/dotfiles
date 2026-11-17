// Dungeon Crawler Carl layout: the left sidebar. Spaces are floors of the
// dungeon; agents are the crawlers, and a Claude Code agent shows how many crawlers it has left.

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { spaces, agents, panes, run, theme, setAgentOrder, openOverlay } from "herdr";
import { who } from "./cast.js";
import { avatar } from "./avatar.js";
import { floorOf } from "./floors.js";
import { readContext, kilo, crawlerColor } from "./context.js";

const floorNum = (id) => { const s = spaces().find((x) => x.id === id); return s ? floorOf(s).n : 0; };

const LABEL = {
  working: "IN COMBAT",
  blocked: "AWAITS YOUR INPUT",
  done: "ACHIEVEMENT UNLOCKED",
  idle: "RESTING IN SAFE ROOM",
};

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
  init(_p, cx) {
    this.ctxs = new Map(); // agent address -> context readout, for Claude Code agents
    this.seen = new Map(); // agent address -> last status seen
    cx.timer.every(20000, (cx) => agents().forEach((a) => this.refresh(a, cx)));
  }

  // Look at how full an agent's context is. Quietly nothing for other agents, remote machines or no transcript.
  refresh(a, cx) {
    const cwd = panes().find((p) => p.pane === a.pane)?.cwd;
    const remote = spaces().find((s) => s.id === a.space)?.machine;
    if (a.app !== "claude-code" || remote || !cwd) { this.ctxs.delete(a.address); return; }
    cx.spawn(async (cx) => {
      this.ctxs.set(a.address, await readContext(cwd));
      cx.notify();
    });
  }

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
    const ctx = this.ctxs.get(a.address);
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
              .on_click((_e, cx) => { cx.stop_propagation(); openOverlay({ mod: "dcc-cast", kind: "dialog", width: 1100, height: 780, props: { address: a.address } }); })
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
      // Crawlers remaining: how much of the agent's context window is still free (Claude Code agents only).
      .when(Boolean(ctx), (el) =>
        el
          .child(div().text_size(9).text_color(crawlerColor(ctx.frac, t)).child(`${kilo(ctx.left)} of ${kilo(ctx.total)} crawlers remaining`))
          .child(
            div().h(4).rounded(2).bg(t.border).overflow_hidden().child(
              div().h_full().w(`${Math.max(1, Math.round(ctx.frac * 100))}%`).rounded(2).bg(crawlerColor(ctx.frac, t)).transition("width", 500)
                .when(ctx.frac <= 0.15, (d) => d.loop("opacity", { from: 0.45, to: 1, period: 900 })),
            ),
          ),
      )
      .child(div().text_size(9).font_semibold().text_color(color).child(LABEL[a.status] ?? ""));
  }

  render(cx) {
    const t = theme();
    const all = spaces();
    const list = agents();
    setAgentOrder(list.map((a) => a.address));
    // A finished turn changes the numbers: look again whenever an agent's status changes.
    for (const a of list) if (this.seen.get(a.address) !== a.status) { this.seen.set(a.address, a.status); this.refresh(a, cx); }
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
