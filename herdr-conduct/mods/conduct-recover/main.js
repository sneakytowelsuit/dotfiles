// Conduct layout: get a stuck, errored or hung agent moving again. Opened with props { address }.
//   the agent, its state and age, the tail of its screen, then the actions (the destructive ones need a second click),
//   the result of the last action, and the auto-nudge settings (shared "conduct.recover").

import { View, div } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import { props, closeOverlay, theme, shared, setShared } from "herdr";
import { NAME, SAYS, colorOf, ink, model, age } from "./attn.js";
import { canResume, normConfig } from "./recover.js";
import { useClock, readTail, statusCheck, interruptThenCheck, restart, kill, planRestart } from "./recover-actions.js";

export default class ConductRecover extends View {
  init(_p, cx) {
    this.cx = cx;
    useClock(cx);
    this.address = props()?.address ?? null;
    this.screen = "";
    this.confirm = null; // action id waiting for its second click
    this.busy = "";
    this.result = null; // { ok, text }
    this.plan = null; // { spec } | { error }, for the restart wording
    this.handle = cx.focus_handle();
    this.minutes = InputState.new({ value: String(normConfig(shared("conduct.recover")).autoNudge.minutes) });
    this.minutes.on("submit", () => this.saveMinutes());
    cx.timer.after(150, () => this.handle.focus());
    cx.spawn(async (cx) => { this.plan = await planRestart(this.address); await this.refresh(); cx.notify(); });
    cx.timer.every(4000, (cx) => cx.spawn(async (cx) => { if (!this.busy) await this.refresh(); cx.notify(); }));
  }

  on(fn) { return () => fn(); } // never keep a handler's cx; this.cx (init's AsyncContext) is what survives awaits

  node() { return this.address ? model().nodes.get(this.address) ?? null : null; }

  async refresh() { if (this.address) this.screen = await readTail(this.address, 14); }

  // First click asks, second click does it.
  ask(id, fn) {
    if (this.confirm !== id) { this.confirm = id; this.cx.notify(); return; }
    this.confirm = null;
    return this.run(id, fn);
  }

  async run(id, fn) {
    if (this.busy) return;
    this.busy = id;
    this.result = null;
    this.cx.notify();
    let r;
    try { r = await fn(); } catch (e) { r = { ok: false, text: String(e.message ?? e) }; }
    this.busy = "";
    this.result = r;
    await this.refresh();
    this.cx.notify();
  }

  setConfig(patch) {
    const c = normConfig(shared("conduct.recover"));
    setShared("conduct.recover", { autoNudge: { ...c.autoNudge, ...patch } });
    this.cx.notify();
  }

  saveMinutes() {
    const m = Number(this.minutes.value());
    if (Number.isFinite(m) && m >= 1) this.setConfig({ minutes: Math.min(600, Math.round(m)) });
  }

  key(e, cx) {
    if (e.key === "escape") {
      if (this.confirm) { this.confirm = null; cx.notify(); } else closeOverlay(props().overlay);
      cx.stop_propagation();
    }
  }

  btn(t, id, label, o = {}) {
    const col = o.danger ? t.blocked : o.primary ? t.accent : null;
    return h_flex().id(id).h(28).px(12).flex_none().items_center().justify_center().rounded(8).cursor_pointer().text_size(11).font_semibold()
      .border_1().border_color(col ?? t.input).bg(o.filled && col ? col : t.raised).text_color(o.filled && col ? ink(col) : col ?? t.foreground)
      .hover((x) => x.opacity(0.88)).on_click(this.on(o.fn)).child(label);
  }

  // One action: title and explanation on the left, its button (or confirm / cancel) on the right.
  action(t, id, title, about, label, fn, o = {}) {
    const asking = this.confirm === id;
    const loading = this.busy === id;
    return h_flex().gap(12).items_center().py(9).border_b(1).border_color(t.border)
      .child(v_flex().flex_1().min_w(0).gap(2)
        .child(div().text_size(12).font_semibold().text_color(o.danger ? t.blocked : t.foreground).child(title))
        .child(div().text_size(10.5).text_color(t.muted).child(about))
        .when(asking && Boolean(o.warn), (el) => el.child(div().text_size(10.5).font_semibold().text_color(t.blocked).child(o.warn))))
      .child(asking
        ? h_flex().gap(6).flex_none()
            .child(this.btn(t, `rc-ok-${id}`, "Yes, do it", { danger: true, filled: true, fn: () => this.ask(id, fn) }))
            .child(this.btn(t, `rc-no-${id}`, "Cancel", { fn: () => { this.confirm = null; this.cx.notify(); } }))
        : this.btn(t, `rc-${id}`, loading ? "Working…" : label, { danger: o.danger, fn: () => (this.busy ? null : o.danger ? this.ask(id, fn) : this.run(id, fn)) }));
  }

  render() {
    const t = theme();
    const n = this.node();
    const color = n ? colorOf(t, n.status) : t.dim;
    const cfg = normConfig(shared("conduct.recover")).autoNudge;
    const a = this.address;
    const spec = this.plan?.spec;
    const resume = spec ? canResume(spec.argv) : false;
    const lossy = "It starts a NEW terminal: the old conversation and everything in its context are LOST unless the program resumes by itself.";
    return v_flex().id("c-recover").track_focus(this.handle).on_key_down((e, cx) => this.key(e, cx))
      .w_full().h_full().p(18).gap(10).bg(t.popover).text_color(t.foreground)
      .child(h_flex().flex_none().items_center()
        .child(div().flex_1().text_size(15).font_semibold().child("Get this agent moving"))
        .child(div().text_size(11).text_color(t.dim).child("Esc")))
      .child(v_flex().id("rc-body").flex_1().min_h(0).overflow_y_scrollbar().pr(6).gap(10)
        .when(!n, (el) => el.child(div().text_size(12).text_color(t.dim).child("That agent is gone.")))
        .when(Boolean(n), (el) => el
          .child(h_flex().gap(8).items_center()
            .child(div().flex_none().h(18).px(7).flex().items_center().rounded(9).text_size(9).font_semibold().bg(color).text_color(ink(color)).child(NAME[n.status]))
            .child(div().flex_1().min_w(0).truncate().text_size(13).font_semibold().child(n.title))
            .child(div().flex_none().text_size(10).text_color(t.dim).child(`${SAYS[n.status]} · ${age(n.since)}`)))
          .child(div().text_size(10).text_color(t.dim).child(`${a} · ${n.spaceName} / ${n.tabName}`)))
        .child(div().text_size(10).font_semibold().text_color(t.dim).child("END OF ITS SCREEN"))
        .child(v_flex().p(9).rounded(8).bg(t.background).border_1().border_color(t.border)
          .child(div().text_size(10.5).text_color(t.muted).child(this.screen || "(nothing on screen)")))
        .child(div().text_size(10).font_semibold().text_color(t.dim).pt(4).child("ACTIONS"))
        .child(v_flex()
          .child(this.action(t, "status", "Ask for a status", "Types a one-line question into it, then shows the end of its screen after a few seconds. Safe.", "Ask", () => statusCheck(a)))
          .child(this.action(t, "interrupt", "Interrupt, then ask", "Presses its stop key (like Esc), waits a moment, then asks for a status. For one that is hung on a command.", "Interrupt", () => interruptThenCheck(a)))
          .child(this.action(t, "restart", "Restart", `Ends it and starts the same command again with the same name, folder and parent${spec ? ` (${spec.argv.join(" ").slice(0, 60)})` : ""}. ${lossy}`, "Restart…", () => restart(a, false),
            { danger: true, warn: lossy + " Press the button again to restart." }))
          .when(resume, (el) => el.child(this.action(t, "resume", "Restart and resume", "Same as Restart, but starts Claude Code with --continue so it picks up the latest conversation in that folder (it may pick a different session if several ran there).", "Restart + resume…", () => restart(a, true),
            { danger: true, warn: "Ends it now and continues the most recent Claude conversation in its folder. Press again to do it." })))
          .child(this.action(t, "kill", "End it", "Ends its program for good. Nothing is started again.", "End it…", () => kill(a), { danger: true, warn: "This ends the agent and its work in progress." })))
        .when(Boolean(this.result), (el) => el.child(v_flex().p(9).rounded(8).border_1().border_color(this.result.ok ? t.done : t.blocked)
          .child(div().text_size(10).font_semibold().text_color(this.result.ok ? t.done : t.blocked).child(this.result.ok ? "DONE" : "DID NOT WORK"))
          .child(div().text_size(11).text_color(t.foreground).child(this.result.text))))
        .child(div().text_size(10).font_semibold().text_color(t.dim).pt(6).child("AUTO-NUDGE"))
        .child(h_flex().gap(10).items_center()
          .child(h_flex().id("rc-auto").gap(10).items_center().cursor_pointer().on_click(this.on(() => this.setConfig({ on: !cfg.on })))
            .child(div().flex_none().w(30).h(16).rounded(8).border_1().border_color(cfg.on ? t.accent : t.input).bg(cfg.on ? t.accent : t.raised).flex().items_center()
              .child(div().size(10).rounded_full().ml(cfg.on ? 16 : 3).bg(cfg.on ? t.accent_foreground : t.dim)))
            .child(div().text_size(12).font_semibold().child("Ask stuck agents for a status after")))
          .child(div().w(56).flex_none().child(Input.new(this.minutes).h(28).px(8).rounded(7).border_1().border_color(t.input).bg(t.background).text_size(12).text_color(t.foreground)))
          .child(div().text_size(12).text_color(t.dim).child("min"))
          .child(this.btn(t, "rc-save", "Save", { fn: () => this.saveMinutes() })))
        .child(div().text_size(10).text_color(t.dim).child("Once per stall, only for STUCK? agents (never blocked or errored ones). Off by default; applies to every agent.")))
      .child(h_flex().flex_none().justify_end().child(this.btn(t, "rc-close", "Close", { fn: () => closeOverlay(props().overlay) })));
  }
}
