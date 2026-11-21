// Conduct layout: snooze one agent. A small dialog opened with props { address }.
//   preset buttons (5 min, 15 min, 1 hour, this afternoon, tomorrow 09:00), a custom minutes box,
//   "Tell me when this finishes" (shared "conduct.watch"), and "Un-snooze".
// A snooze (shared "conduct.snooze") ends at its time or as soon as the agent changes state.

import { View, div } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import { props, closeOverlay, notify, theme, shared, setShared } from "herdr";
import { NAME, colorOf, ink, model, age } from "./attn.js";
import { markOf, snoozeFor, unsnooze, isSnoozed, presets, untilText, minutesToUntil, setWatch } from "./snooze.js";

export default class ConductSnooze extends View {
  init(_p, cx) {
    this.cx = cx;
    this.address = props()?.address ?? null;
    this.error = "";
    this.handle = cx.focus_handle();
    this.minutes = InputState.new({ value: "" });
    this.minutes.on("submit", () => this.custom());
    cx.timer.after(150, () => this.handle.focus());
  }

  on(fn) { return () => fn(); } // never keep a handler's cx

  node() { return this.address ? model().nodes.get(this.address) ?? null : null; }

  close() { closeOverlay(props().overlay); }

  snooze(until) {
    const n = this.node();
    if (!n) return;
    setShared("conduct.snooze", snoozeFor(shared("conduct.snooze") ?? {}, n.address, markOf(n), until));
    notify({ title: `${n.title} snoozed until ${untilText(until, Date.now())}`, level: "info", timeout: 2500 });
    this.close();
  }

  custom() {
    const until = minutesToUntil(this.minutes.value(), Date.now());
    if (until == null) { this.error = "Enter whole minutes, 1 to 10080."; this.cx.notify(); return; }
    this.snooze(until);
  }

  unsnooze() {
    if (!this.address) return;
    setShared("conduct.snooze", unsnooze(shared("conduct.snooze") ?? {}, this.address));
    this.close();
  }

  toggleWatch() {
    if (!this.address) return;
    const on = (shared("conduct.watch") ?? []).includes(this.address);
    setShared("conduct.watch", setWatch(shared("conduct.watch") ?? [], this.address, !on));
    this.cx.notify();
  }

  key(e, cx) { if (e.key === "escape") { this.close(); cx.stop_propagation(); } }

  btn(t, id, label, primary, fn) {
    return h_flex().id(id).h(30).px(12).items_center().justify_center().rounded(8).cursor_pointer().text_size(12).font_medium()
      .border_1().border_color(primary ? t.accent : t.input).bg(primary ? t.accent : t.raised).text_color(primary ? t.accent_foreground : t.foreground)
      .hover((x) => x.opacity(0.88)).on_click(this.on(fn)).child(label);
  }

  render() {
    const t = theme();
    const n = this.node();
    const now = Date.now();
    const color = n ? colorOf(t, n.status) : t.dim;
    const entry = (shared("conduct.snooze") ?? {})[this.address];
    const snoozed = n ? isSnoozed(entry, markOf(n), now) : false;
    const watching = (shared("conduct.watch") ?? []).includes(this.address);
    return v_flex().id("c-snooze").track_focus(this.handle).on_key_down((e, cx) => this.key(e, cx))
      .w_full().p(16).gap(10).bg(t.popover).text_color(t.foreground)
      .child(h_flex().items_center()
        .child(div().flex_1().text_size(15).font_semibold().child("Snooze"))
        .child(div().text_size(11).text_color(t.dim).child("Esc")))
      .when(!n, (el) => el.child(div().text_size(12).text_color(t.dim).child("That agent is gone.")))
      .when(Boolean(n), (el) => el.child(
        h_flex().gap(8).items_center()
          .child(div().flex_none().h(18).px(7).flex().items_center().rounded(9).text_size(9).font_semibold().border_1().border_color(color).text_color(color).child(NAME[n.status]))
          .child(div().flex_1().min_w(0).truncate().text_size(12).font_semibold().child(n.title))
          .child(div().flex_none().text_size(10).text_color(t.dim).child(age(n.since)))))
      .when(snoozed, (el) => el.child(div().text_size(11).text_color(t.muted).child(`Snoozed until ${untilText(entry.until, now)}. It comes back sooner if it changes state.`)))
      .child(div().text_size(11).text_color(t.dim).child("Hide it until…"))
      .child(v_flex().gap(6).children(presets(now).map((p) =>
        this.btn(t, `sn-${p.id}`, `${p.label}  ·  ${untilText(p.until, now)}`, false, () => this.snooze(p.until)))))
      .child(h_flex().gap(8).items_center()
        .child(div().flex_1().child(Input.new(this.minutes).h(30).px(9).rounded(7).border_1().border_color(t.input).bg(t.background).text_size(12).text_color(t.foreground)))
        .child(div().flex_none().text_size(11).text_color(t.dim).child("minutes"))
        .child(this.btn(t, "sn-custom", "Snooze", true, () => this.custom())))
      .when(Boolean(this.error), (el) => el.child(div().text_size(11).text_color(t.blocked).child(this.error)))
      // Watch: a plain toggle (outline when off, accent-filled when on).
      .child(h_flex().id("sn-watch").gap(10).items_center().pt(4).cursor_pointer().on_click(this.on(() => this.toggleWatch()))
        .child(div().flex_none().w(30).h(16).rounded(8).border_1().border_color(watching ? t.accent : t.input).bg(watching ? t.accent : t.raised).flex().items_center()
          .child(div().size(10).rounded_full().ml(watching ? 16 : 3).bg(watching ? t.accent_foreground : t.dim)))
        .child(v_flex().gap(1)
          .child(div().text_size(12).font_semibold().child("Tell me when this finishes"))
          .child(div().text_size(10).text_color(t.dim).child("Raises an alert when it next finishes, even while snoozed."))))
      .child(h_flex().pt(4).gap(8).justify_end()
        .when(snoozed, (el) => el.child(this.btn(t, "sn-un", "Un-snooze", false, () => this.unsnooze())))
        .child(this.btn(t, "sn-close", "Close", false, () => this.close())));
  }
}
