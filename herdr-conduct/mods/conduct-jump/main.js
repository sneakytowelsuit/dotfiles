import { View, div } from "gpui-kit";
import { h_flex, v_flex, Input, InputState, ScrollHandle } from "gpui-base";
import { closeOverlay, props, run, shared, spaces, theme } from "herdr";
import { age, colorOf, go, model, needs, sorted } from "./attn.js";
import { rankEntries } from "./search.js";

export { previous } from "./attn.js";

function entries() {
  const agents = sorted(model().list);
  const destinations = spaces();
  const tabs = new Map(destinations.flatMap((s) => s.tabs.map((tab) => [tab.id, tab])));
  const rows = agents.map((a) => {
    const spaceName = a.spaceName || "No space";
    const tabName = a.tabName || "No tab";
    return {
      id: `agent-${a.address}`, address: a.address, title: a.title, location: `${spaceName} / ${tabName}`,
      fields: [a.title, a.name, a.address, a.spaceName, a.tabName, a.msg, tabs.get(a.tab)?.index],
      status: a.status, since: a.since, attention: needs(a), agent: a,
    };
  });
  for (const space of destinations) {
    rows.push({
      id: `space-${space.id}`, title: space.name, location: "Space",
      fields: [space.name, space.id, space.folder, space.branch, "space"],
      status: space.status, space: space.id,
    });
    for (const tab of space.tabs) {
      const title = tab.named ? tab.name : agents.find((a) => a.tab === tab.id)?.title || tab.name;
      rows.push({
        id: `tab-${tab.id}`, title, location: `${space.name} / ${tab.name}`, status: tab.status,
        since: tab.changed_at ?? tab.working_since, space: space.id, tab: tab.id,
        fields: [title, space.name, tab.name, tab.index, tab.id, "tab"],
      });
    }
  }
  return rows;
}

export default class ConductJump extends View {
  init(_p, cx) {
    this.selected = null;
    this.closed = false;
    this.handle = cx.focus_handle();
    this.scroll = new ScrollHandle();
    this.input = InputState.new({ value: "", placeholder: "Search agents, spaces, and tabs…" });
    this.input.on("change", (_event, cx) => {
      this.selected = null;
      this.scroll.scroll_to_item(0);
      cx.notify();
    });
    this.input.on("submit", () => { const rows = this.rows(); this.choose(rows[this.index(rows)]); });
    cx.timer.after(100, () => this.input.focus());
    cx.timer.every(15000, (cx) => cx.notify());
  }

  rows() {
    return rankEntries(this.input.value(), entries(), shared("conduct.recent"));
  }

  index(rows) {
    return Math.max(0, rows.findIndex((row) => row.id === this.selected));
  }

  closePalette() {
    if (this.closed) return;
    this.closed = true;
    closeOverlay(props().overlay);
  }

  choose(row) {
    if (!row || this.closed) return;
    this.closePalette();
    if (row.agent) go(row.agent);
    else {
      run("space.select", { id: row.space });
      if (row.tab) run("tab.select", { id: row.tab });
    }
  }

  key(event, cx) {
    const key = event.keystroke;
    if (key === "escape") {
      cx.stop_propagation();
      this.closePalette();
    } else if (key === "up" || key === "down" || key === "enter") {
      cx.stop_propagation();
      const rows = this.rows();
      if (!rows.length) return;
      const index = this.index(rows);
      if (key === "enter") this.choose(rows[index]);
      else {
        const next = Math.max(0, Math.min(rows.length - 1, index + (key === "up" ? -1 : 1)));
        this.selected = rows[next].id;
        this.scroll.scroll_to_item(next);
        cx.notify();
      }
    }
  }

  render() {
    const t = theme();
    const rows = this.rows();
    const index = this.index(rows);
    return v_flex().id("conduct-jump").track_focus(this.handle).on_key_down((event, cx) => this.key(event, cx))
      .size_full().p(14).gap(8).bg(t.popover).text_color(t.foreground)
      .child(Input.new(this.input).flex_none().h(34).px(10).rounded(6).border_1().border_color(t.input)
        .bg(t.background).text_size(13).text_color(t.foreground))
      .child(v_flex().id("jump-results").flex_1().min_h(0).overflow_y_scrollbar().track_scroll(this.scroll)
        .when(!rows.length, (el) => el.child(div().p(8).text_size(12).text_color(t.dim).child("No matches.")))
        .children(rows.map((row, i) => {
          const color = colorOf(t, row.status);
          return h_flex().id(`jump-${row.id}`).flex_none().min_h(38).px(8).gap(8).items_center()
            .rounded(5).border_1().border_color(i === index ? t.accent : t.popover)
            .when(i === index, (el) => el.bg(t.raised))
            .hover((el) => el.bg(t.hover)).cursor_pointer().on_click(() => this.choose(row))
            .child(div().flex_none().size(7).rounded_full().border_1().border_color(color)
              .when(needs(row), (el) => el.bg(color)))
            .child(v_flex().flex_1().min_w(0)
              .child(div().truncate().text_size(12).font_semibold().child(row.title))
              .child(div().truncate().text_size(11).text_color(t.muted).child(row.location)))
            .child(div().flex_none().text_size(11).text_color(t.dim).child(age(row.since)));
        })))
      .child(div().flex_none().text_size(11).text_color(t.dim).child("↑ ↓ Move   ·   Enter Jump   ·   Esc Close"));
  }
}
