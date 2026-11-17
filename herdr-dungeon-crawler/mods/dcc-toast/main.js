// Dungeon Crawler Carl layout: notifications as System AI announcements.

import { View, div, image, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { props, closeOverlay, run, theme } from "herdr";

const HEAD = { error: "WARNING, CRAWLER", warning: "A WORD OF CAUTION", success: "ACHIEVEMENT UNLOCKED!", info: "SYSTEM NOTICE" };
const TONE = { error: "blocked", warning: "working", success: "done", info: "accent" };

export default class DccToast extends View {
  render() {
    const t = theme();
    const p = props() ?? {};
    const lvl = p.level ?? "info";
    const color = t[TONE[lvl] ?? "accent"];
    return h_flex()
      .id("dcc-toast")
      .size_full()
      .px(14)
      .gap(12)
      .items_center()
      .bg(t.popover)
      .border_l(3)
      .border_color(color)
      .cursor_pointer()
      .hover((s) => s.bg(t.raised))
      .on_click(() => {
        if (p.action?.name) run(p.action.name, p.action.args ?? {});
        closeOverlay(p.overlay);
      })
      .child(p.icon ? image(p.icon).w(20).h(20).flex_none() : svg("mods/dcc-bar/skull.svg").size(20).flex_none().text_color(color))
      .child(
        v_flex()
          .flex_1()
          .overflow_hidden()
          .child(div().truncate().text_size(10).font_semibold().text_color(color).child(HEAD[lvl] ?? HEAD.info))
          .child(div().truncate().text_size(13).font_semibold().text_color(t.foreground).child(p.title ?? ""))
          .when(Boolean(p.body), (el) => el.child(div().truncate().text_size(11).text_color(t.muted).child(p.body))),
      );
  }
}
