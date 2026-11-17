// Dungeon Crawler Carl layout: choose which character an agent is.
// Props: { address, overlay }. The choice is kept in shared state ("dcc.cast"); the portrait
// on each card plays the animation for the agent's status right now.

import { View, div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { props, closeOverlay, agents, theme } from "herdr";
import { CAST, who, setCast, isCastPicked } from "./cast.js";
import { avatar } from "./avatar.js";

const CARD_W = 140;
const PER_ROW = 7;

export default class DccCast extends View {
  card(t, c, status, current, address, overlay) {
    const on = c.name === current.name;
    return v_flex()
      .id(`dcc-cast-${c.name}`)
      .flex_none()
      .w(CARD_W)
      .h(214)
      .p(10)
      .gap(6)
      .items_center()
      .rounded(4)
      .border_1()
      .border_color(on ? c.color : t.border)
      .bg(on ? c.color + "1a" : t.surface)
      .cursor_pointer()
      .hover((s) => s.border_color(c.color))
      .on_click(() => { setCast(address, c.name); closeOverlay(overlay); })
      .child(avatar(t, status, c, 56))
      .child(div().min_h(32).text_size(12).font_semibold().text_color(t.foreground).text_center().child(c.name))
      .child(div().min_h(26).text_size(10).text_color(t.dim).text_center().child(c.role))
      .child(div().min_h(42).text_size(10).text_color(c.color).text_center().child(`"${c.say[status] ?? c.say.idle}"`))
      .child(div().h(14).when(on, (el) => el.child(div().px(5).text_size(9).font_semibold().rounded(2).bg(c.color).text_color("#140a06").child("CURRENT"))));
  }

  render() {
    const t = theme();
    const p = props() ?? {};
    const agent = agents().find((a) => a.address === p.address);
    if (!agent) return div().p(16).bg(t.popover).text_color(t.muted).text_size(12).child("That agent has gone.");
    const current = who(agent.address);
    const status = agent.status ?? "idle";
    const rows = [];
    for (let i = 0; i < CAST.length; i += PER_ROW) rows.push(CAST.slice(i, i + PER_ROW));
    return v_flex()
      .id("dcc-cast")
      .size_full()
      .bg(t.popover)
      .p(16)
      .gap(12)
      .child(
        h_flex().flex_none().items_center().gap(10)
          .child(div().flex_1().min_w(0).child(
            v_flex().gap(2)
              .child(div().text_size(13).font_semibold().text_color(t.accent).child("CHOOSE A CRAWLER"))
              .child(div().truncate().text_size(11).text_color(t.muted).child(`for ${agent.program?.name ?? agent.app ?? "this agent"} in ${agent.space_name} (${agent.address})`))))
          .when(isCastPicked(agent.address), (el) => el.child(
            div().id("dcc-cast-auto").flex_none().px(10).py(5).rounded(3).border_1().border_color(t.border).text_size(11).text_color(t.muted).cursor_pointer()
              .hover((s) => s.border_color(t.accent).text_color(t.foreground))
              .on_click(() => { setCast(agent.address, null); closeOverlay(p.overlay); })
              .child("Back to automatic"))),
      )
      .children(rows.map((row) => h_flex().flex_none().gap(12).children(row.map((c) => this.card(t, c, status, current, agent.address, p.overlay)))));
  }
}
