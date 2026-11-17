// Dungeon Crawler Carl layout: a pane header, styled as a mob's nameplate.
// For a Claude Code agent it also draws a "crawlers remaining" bar along its top edge: how much
// of the model's context window is still free, read from the usage numbers Claude Code records.

import { View, div, svg, image } from "gpui-kit";
import { h_flex } from "gpui-base";
import { panes, agents, spaces, props, run, theme, home, openOverlay } from "herdr";
import { who } from "./cast.js";
import { avatar } from "./avatar.js";
import { readContext, kilo, crawlerColor } from "./context.js";

const TAG = { working: "IN COMBAT", blocked: "YOUR MOVE, CRAWLER", done: "ACHIEVEMENT!", idle: null };

function folder(cwd) {
  if (!cwd) return "";
  const h = home();
  return cwd === h ? "~" : cwd.startsWith(h + "/") ? "~" + cwd.slice(h.length) : cwd;
}

export default class DccPane extends View {
  init(_p, cx) {
    this.hovered = false;
    this.ctx = null; // { used, total, model } for a Claude Code agent
    this.lastStatus = undefined;
    this.refresh(cx);
    cx.timer.every(20000, (cx) => this.refresh(cx));
  }

  // Read how full the agent's context is. Quietly shows nothing when it can't be worked out
  // (another kind of agent, a remote machine, no transcript).
  refresh(cx) {
    const p = panes().find((x) => x.pane === props()?.pane);
    const ag = p && agents().find((x) => x.pane === p.pane);
    const remote = ag && spaces().find((s) => s.id === ag.space)?.machine;
    if (!ag || ag.app !== "claude-code" || !p.cwd || remote) {
      if (this.ctx) { this.ctx = null; cx.notify(); }
      return;
    }
    cx.spawn(async (cx) => {
      this.ctx = await readContext(p.cwd);
      cx.notify();
    });
  }

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

  render(cx) {
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

    // A finished turn changes the numbers: look again when the agent's status changes.
    if (ag && this.lastStatus !== ag.status) {
      if (this.lastStatus !== undefined) this.refresh(cx);
      this.lastStatus = ag.status;
    }
    const k = this.ctx;
    const left = k ? Math.max(0, k.total - k.used) : 0;
    const frac = k ? left / k.total : 0;
    const pct = Math.round(frac * 100);
    const bar = crawlerColor(frac, t);

    return h_flex()
      .id(`dcc-ph-${pane}`)
      .relative()
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
      // Remaining crawlers: a track and a fill along the very top edge of the pane.
      .when(Boolean(k), (el) =>
        el
          .child(div().absolute().left(0).top(0).w_full().h(3).bg(t.border))
          .child(div().absolute().left(0).top(0).h(3).w(`${Math.max(1, pct)}%`).bg(bar).transition("width", 500)
            .when(frac <= 0.15, (d) => d.loop("opacity", { from: 0.45, to: 1, period: 900 }))))
      .child(div().flex_none().w(3).h(14).rounded(1).bg(color))
      .when(Boolean(c), (el) => el.child(
        div().id(`dcc-pav-${pane}`).flex_none().cursor_pointer().tooltip("Choose character")
          .on_click((_e, cx) => { cx.stop_propagation(); openOverlay({ mod: "dcc-cast", kind: "dialog", width: 1260, height: 780, props: { address: ag.address } }); })
          .child(avatar(t, p.status ?? ag.status, c, 30))))
      .when(!c && Boolean(g?.icon), (el) => el.child(g.tint ? svg(g.icon).size(13).flex_none().text_color(t.muted) : image(g.icon).w(13).h(13).flex_none()))
      .child(div().flex_none().truncate().max_w(240).font_semibold().text_color(p.focused ? t.accent : t.foreground).child(name))
      .child(div().flex_1().truncate().text_color(t.dim).child((c ? `${g?.name ?? "agent"} · ` : "") + folder(p.cwd) + (p.branch ? `  ⎇ ${p.branch}` : "")))
      .when(Boolean(k), (el) =>
        el.child(
          div().id(`dcc-rc-${pane}`).flex_none().text_size(9).font_semibold().text_color(bar)
            .tooltip(`${kilo(left)} of ${kilo(k.total)} crawlers remaining (${pct}%). Each crawler is a token of the agent's context window (${k.model}); ${kilo(k.used)} have fallen so far.`)
            .child(`${kilo(left)} of ${kilo(k.total)} crawlers remaining`),
        ),
      )
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
