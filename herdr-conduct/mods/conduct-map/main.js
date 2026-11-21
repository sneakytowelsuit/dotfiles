import { View, div } from "gpui-kit";
import { h_flex, v_flex, ScrollHandle } from "gpui-base";
import { closeOverlay, props, settings, theme } from "herdr";
import { age, colorOf, go, ink, model, NAME, needs, ORDER } from "./attn.js";
import { bindings, byId, pretty } from "./keys.js";
import { stateIcon } from "./glyphs.js";
import { cellSize, filterGroups, gridRows, groupAgents, moveFocus } from "./grid.js";
import { MAP_ACTIONS } from "./map-keys.js";

const GAP = 4;
const bindingList = (action) => byId(action.id) ? bindings(action.id) : action.def;

export default class ConductMap extends View {
  init(_p, cx) {
    this.filter = null;
    this.address = null;
    this.width = 0;
    this.focus = cx.focus_handle();
    this.scroll = new ScrollHandle();
    this.cx = cx;
    cx.timer.after(150, () => this.focus.focus());
    cx.timer.every(4000, (cx) => cx.notify());
  }

  open(agent) {
    closeOverlay(props().overlay);
    go(agent);
  }

  key(e, cx, rows, active) {
    const key = String(e.keystroke ?? "").toLowerCase();
    const action = MAP_ACTIONS.find((a) => bindingList(a).some((b) => b.toLowerCase() === key));
    if (!action) return;
    cx.stop_propagation();
    if (action.id === "map.close") {
      closeOverlay(props().overlay);
      return;
    }
    if (action.id === "map.go") {
      if (active) this.open(active);
      return;
    }
    const next = moveFocus(rows, active?.address, action.id.slice(4));
    if (next) {
      this.address = next.address;
      this.scroll.scroll_to_item(rows.findIndex((row) => row.agents?.includes(next)));
      cx.notify();
    }
  }

  cell(t, agent, size, focused) {
    const color = colorOf(t, agent.status);
    const critical = needs(agent);
    const name = agent.name || agent.title || agent.address;
    const state = NAME[agent.status] ?? agent.status;
    const elapsed = age(agent.since) || "time unknown";
    const place = `${agent.spaceName || agent.space || "Unknown space"} / ${agent.tabName || agent.tab || "Unknown tab"}`;
    const label = `${name} · ${agent.title} · ${state} · ${elapsed} · ${place}`;
    const icon = stateIcon(t, agent.status, size === 22 ? 12 : 18)
      .when(critical, (el) => el.text_color(ink(color)))
      .when(agent.status === "working", (el) => el.spin(1800));

    return v_flex().id(`map-agent-${agent.address}`).relative().flex_none().size(size).p(2)
      .items_center().justify_center().gap(2).rounded(4).cursor_pointer()
      .tooltip(label).role("button").accessibility_label(label)
      .when(focused, (el) => el.aria_active_descendant())
      .on_click(() => this.open(agent))
      .child(div().absolute().inset(2).rounded(3).border_1().border_color(color)
        .when(critical, (el) => el.bg(color).loop("opacity", { from: 0.85, to: 1, period: 1300 }))
        .when(agent.status === "working", (el) => el.loop("opacity", { from: 0.45, to: 1, period: 2200 })))
      .when(focused, (el) => el.child(div().absolute().inset(0).rounded(4).border_2().border_color(t.accent)))
      .child(icon)
      .when(size === 56, (el) => el.child(div().w_full().px(2).truncate().text_center().text_size(10)
        .text_color(critical ? ink(color) : t.foreground).child(name)));
  }

  chip(t, status, count) {
    const selected = status === this.filter;
    const label = `${NAME[status]} ${count}`;
    return h_flex().id(`map-filter-${status}`).flex_none().h(24).px(6).gap(4).items_center()
      .rounded(12).border_1().border_color(selected ? t.accent : colorOf(t, status))
      .bg(selected ? t.selected : t.surface).hover((s) => s.bg(t.hover)).cursor_pointer()
      .role("button").accessibility_label(selected ? `${label}, clear filter` : `${label}, filter`)
      .on_click(() => {
        this.filter = selected ? null : status;
        this.address = null;
        this.scroll.scroll_to_item(0);
        this.focus.focus();
        this.cx.notify();
      })
      .child(stateIcon(t, status, 12)).child(div().text_size(11).child(label));
  }

  render() {
    const t = theme();
    const { list } = model();
    const size = cellSize(list.length);
    const zoom = Number(settings()?.zoom) || 1;
    // Leave room for the body's right padding and native scrollbar.
    const columns = Math.max(1, Math.floor((this.width / zoom - 20 + GAP) / (size + GAP)));
    const rows = gridRows(filterGroups(groupAgents(list), this.filter), columns);
    const visible = rows.flatMap((row) => row.agents ?? []);
    const active = visible.find((a) => a.address === this.address) ?? visible[0];
    const hints = MAP_ACTIONS.map((a) => bindingList(a).map(pretty).join(" / "));
    const footer = [[hints.slice(0, 4).filter(Boolean).join(" "), "Move"], [hints[4], "Go"], [hints[5], "Close"]]
      .filter(([keys]) => keys).map(([keys, label]) => `${keys} ${label}`).join(" · ");

    return v_flex().id("conduct-map").size_full().min_h(0).min_w(0).p(12).gap(6)
      .bg(t.surface).text_color(t.foreground).track_focus(this.focus)
      .on_key_down((e, cx) => this.key(e, cx, rows, active))
      .child(h_flex().flex_none().items_center().justify_between()
        .child(div().text_size(16).font_semibold().child("Agent map"))
        .child(div().text_size(11).text_color(t.muted).child(`${list.length} agents`)))
      .child(h_flex().id("map-legend").w_full().min_w(0).flex_none().gap(4).overflow_x_scrollbar()
        .children(ORDER.map((status) => this.chip(t, status, list.filter((a) => a.status === status).length))))
      .child(v_flex().id("map-grid").w_full().flex_1().min_h(0).min_w(0).gap(GAP).pr(6)
        .on_size_change(({ width }, cx) => {
          if (Math.abs(width - this.width) > 0.5) {
            this.width = width;
            cx.notify();
          }
        })
        .track_scroll(this.scroll).overflow_y_scrollbar()
        .children(rows.length ? rows.map((row) => row.agents
          ? h_flex().flex_none().gap(GAP).children(row.agents.map((a) => this.cell(t, a, size, a === active)))
          : div().flex_none().pt(4).text_size(11).font_semibold().text_color(t.muted).truncate().child(row.title))
          : [div().pt(8).text_size(12).text_color(t.muted).child(this.filter ? "No agents in this state" : "No agents")]))
      .when(footer, (el) => el.child(div().flex_none().text_size(11).text_color(t.muted).truncate().child(footer)));
  }
}
