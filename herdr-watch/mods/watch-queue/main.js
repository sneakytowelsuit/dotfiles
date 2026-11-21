// Watch layout: the left sidebar. An attention queue: agents that need you first (filled, haloed
// rows), then the ones working, then the quiet ones. Sub-agents sit under the agent that started them.
// Below it, spaces with their worst status, so you can see which one is calling.

import { View, div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { agents, spaces, terminals, run, theme } from "herdr";
import { readActivity } from "./activity.js";
import { NAME, SAYS, needs, sorted, colorOf, ink, go, halo } from "./attn.js";

const heading = (t, label, n, color) =>
  h_flex().flex_none().px(12).pt(12).pb(5).gap(8).items_center()
    .child(div().text_size(10).font_semibold().text_color(color ?? t.dim).child(label))
    .child(div().text_size(10).text_color(t.dim).child(String(n)))
    .child(div().flex_1().h(1).bg(t.border));

export default class WatchQueue extends View {
  init(_p, cx) {
    this.acts = new Map(); // agent address -> { verb, stats } while it is working
    const look = (cx) =>
      cx.spawn(async (cx) => {
        const live = agents().filter((a) => a.status === "working");
        let changed = false;
        for (const a of live) {
          const next = await readActivity(a.address);
          const prev = this.acts.get(a.address);
          if (JSON.stringify(prev) !== JSON.stringify(next)) { changed = true; next ? this.acts.set(a.address, next) : this.acts.delete(a.address); }
        }
        for (const k of [...this.acts.keys()]) if (!live.some((a) => a.address === k)) { this.acts.delete(k); changed = true; }
        if (changed) cx.notify();
      });
    look(cx);
    cx.timer.every(2000, look);
  }

  row(t, a, parentName) {
    const color = colorOf(t, a.status);
    const loud = needs(a);
    const label = a.title || a.program?.name || "agent";
    const act = a.status === "working" ? this.acts.get(a.address) : null;
    const body = h_flex()
      .id(`w-r-${a.address}`)
      .px(10).py(7).gap(9).items_center().rounded(4).cursor_pointer()
      .border_1().border_color(a.focused ? t.accent : loud ? color : t.border)
      .when(loud, (el) => el.bg(color + "26"))
      .when(!loud, (el) => el.bg(t.surface).hover((s) => s.border_color(color)))
      .on_click(() => go(a))
      .child(
        loud
          ? div().flex_none().w(4).h(30).rounded(2).bg(color).loop("opacity", { from: 0.4, to: 1, period: 1000 })
          : div().flex_none().w(4).h(30).rounded(2).border_1().border_color(color + (a.status === "working" ? "" : "88"))
              .when(a.status === "working", (el) => el.loop("opacity", { from: 0.4, to: 1, period: 1400 })),
      )
      .child(
        v_flex().flex_1().min_w(0).gap(1)
          .child(div().truncate().text_size(12).font_semibold().text_color(loud ? t.foreground : t.muted).child(label))
          .when(Boolean(act), (el) =>
            el.child(
              h_flex().gap(5).min_w(0).text_size(10)
                .child(div().flex_none().font_semibold().text_color(color).loop("opacity", { from: 0.5, to: 1, period: 1100 }).child(`${act.verb}…`))
                .child(div().truncate().text_color(t.dim).child(act.stats)),
            ))
          .child(div().truncate().text_size(10).text_color(t.dim).child(`${parentName ? `↳ ${parentName} · ` : ""}${a.space_name} / ${a.tab_name}`)),
      )
      .child(
        div().flex_none().h(18).px(7).flex().items_center().rounded(9).text_size(9).font_semibold()
          .border_1().border_color(color)
          .when(loud, (el) => el.bg(color).text_color(ink(color)))
          .when(!loud, (el) => el.text_color(color))
          .child(NAME[a.status]),
      )
      .tooltip(`${SAYS[a.status]} · ${a.space_name} / ${a.tab_name}`);
    return loud ? halo(color, 4, 4, body) : div().mx(4).my(1).child(body);
  }

  space(t, s) {
    const color = s.status ? colorOf(t, s.status) : t.dim;
    const loud = s.status === "blocked" || s.status === "done";
    return h_flex()
      .id(`w-s-${s.id}`)
      .mx(8).px(8).py(5).gap(9).items_center().rounded(3).cursor_pointer()
      .when(s.active, (el) => el.bg(t.raised))
      .when(!s.active, (el) => el.hover((x) => x.bg(t.hover)))
      .on_click(() => run("space.select", { id: s.id }))
      .child(div().flex_none().size(8).rounded_full().bg(loud ? color : "#00000000").border_1().border_color(color)
        .when(loud, (el) => el.loop("opacity", { from: 0.35, to: 1, period: 1000 })))
      .child(div().flex_1().truncate().text_size(12).text_color(s.active ? t.foreground : t.muted).child(s.name))
      .child(div().flex_none().text_size(10).text_color(t.dim).child(s.branch ? `⎇ ${s.branch}` : ""));
  }

  render() {
    const t = theme();
    const list = sorted(agents());
    // Sub-agents: parent terminal address, from herdr-core.
    const parent = new Map();
    try { for (const x of terminals()) if (x.parent) parent.set(x.address, x.parent); } catch {}
    const label = (addr) => { const p = list.find((a) => a.address === addr); return p ? p.title || p.program?.name : null; };
    const wants = list.filter(needs);
    const working = list.filter((a) => a.status === "working");
    const quiet = list.filter((a) => a.status === "idle");
    const all = spaces();
    const section = (title, items, color) =>
      items.length ? [heading(t, title, items.length, color), ...items.map((a) => this.row(t, a, label(parent.get(a.address))))] : [];
    return v_flex()
      .id("w-side")
      .size_full()
      .bg(t.chrome)
      .child(
        v_flex().flex_1().min_h(0).overflow_y_scrollbar().pb(8)
          .children(
            list.length
              ? [
                  ...section("NEEDS YOU", wants, t.blocked),
                  ...section("WORKING", working, t.working),
                  ...section("IDLE", quiet),
                ]
              : [div().px(14).py(14).text_size(11).text_color(t.dim).child("No agents running.")],
          ),
      )
      .child(heading(t, "SPACES", all.length))
      .child(v_flex().flex_none().max_h(220).overflow_y_scrollbar().pb(8).children(all.map((s) => this.space(t, s))));
  }
}
