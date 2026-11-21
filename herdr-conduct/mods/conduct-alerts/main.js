// Conduct layout: alert settings. When should Conduct interrupt you? Rules live in alerts.js (and are applied by
// observe.js from the conduct-queue poller); this dialog edits the shared value "conduct.alerts".
//   switches: master, in-app toast, sound, phone/desktop push (ntfy.sh, off by default)
//   quiet hours (HH:MM, may cross midnight), the ntfy topic, "Send test notification".

import { View, div } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import { props, closeOverlay, notify, exec, theme, shared, setShared } from "herdr";
import { normalize, parseTime, validTopic, suggestTopic } from "./alerts.js";

export default class ConductAlerts extends View {
  init(_p, cx) {
    this.cx = cx;
    this.cfg = normalize(shared("conduct.alerts"));
    this.err = {}; // field -> message
    this.msg = null; // { ok, text }
    this.busy = false;
    this.from = InputState.new({ value: this.cfg.quiet.from });
    this.to = InputState.new({ value: this.cfg.quiet.to });
    this.topic = InputState.new({ value: this.cfg.push.topic });
    for (const s of [this.from, this.to]) s.on("submit", () => this.saveQuiet());
    this.topic.on("submit", () => this.saveTopic());
    this.handle = cx.focus_handle();
    cx.timer.after(150, () => this.handle.focus());
  }

  on(fn) { return () => fn(); } // handlers never keep their own cx; this.cx is init's AsyncContext

  key(e, cx) { if (e.key === "escape") { closeOverlay(props().overlay); cx.stop_propagation(); } }

  save(cfg) { this.cfg = cfg; setShared("conduct.alerts", cfg); this.cx.notify(); }
  set(k, v) { this.save({ ...this.cfg, [k]: v }); }

  saveQuiet() {
    const from = this.from.value().trim(), to = this.to.value().trim();
    this.err = { ...this.err, quiet: null };
    if (parseTime(from) == null || parseTime(to) == null) { this.err.quiet = "Use 24-hour times like 22:00 and 08:00."; this.cx.notify(); return; }
    this.save({ ...this.cfg, quiet: { ...this.cfg.quiet, from, to } });
  }

  saveTopic() {
    const topic = this.topic.value().trim();
    this.err = { ...this.err, topic: null };
    if (topic && !validTopic(topic)) { this.err.topic = "8 to 64 letters, digits, - or _."; this.cx.notify(); return false; }
    this.save({ ...this.cfg, push: { ...this.cfg.push, topic } });
    return true;
  }

  suggest() { this.topic.set_value(suggestTopic()); this.saveTopic(); }

  setPush(on) {
    if (on && !this.saveTopic()) return;
    if (on && !validTopic(this.cfg.push.topic)) { this.err = { ...this.err, topic: "Write or generate a topic first." }; this.cx.notify(); return; }
    this.save({ ...this.cfg, push: { ...this.cfg.push, on } });
  }

  // The test sends no agent data: only a fixed sentence.
  async test() {
    if (!this.saveTopic() || !validTopic(this.cfg.push.topic)) { this.msg = { ok: false, text: "Set a valid topic first." }; this.cx.notify(); return; }
    this.busy = true; this.msg = null; this.cx.notify();
    let ok = false, why = "";
    try {
      const r = await exec("curl", ["-sS", "-m", "5", "--fail", "-d", JSON.stringify({ topic: this.cfg.push.topic, title: "Conduct test", message: "Notifications from Conduct work.", tags: ["bell"] }), "https://ntfy.sh"], { timeout: 8000 });
      ok = r.code === 0; why = (r.stderr || "").trim().split("\n")[0];
    } catch (e) { why = String(e?.message ?? e); }
    this.busy = false;
    this.msg = ok ? { ok: true, text: "Sent. It should arrive on a device subscribed to this topic." } : { ok: false, text: `Not sent${why ? `: ${why}` : ""}` };
    notify({ title: ok ? "Test notification sent" : "Test notification failed", level: ok ? "success" : "error", timeout: 3000 });
    this.cx.notify();
  }

  btn(t, id, label, fn, primary) {
    return h_flex().id(id).h(28).px(12).flex_none().items_center().rounded(8).cursor_pointer().text_size(11).font_semibold()
      .border_1().border_color(primary ? t.accent : t.input).bg(primary ? t.accent : t.raised).text_color(primary ? t.accent_foreground : t.foreground)
      .hover((x) => x.opacity(0.88)).on_click(this.on(fn)).child(label);
  }

  // A switch drawn by hand: a track and a knob. Quiet colour for on (only critical states are loud).
  toggle(t, id, on, fn) {
    return div().id(id).flex_none().w(34).h(18).rounded(9).cursor_pointer().relative()
      .border_1().border_color(on ? t.accent : t.input).bg(on ? t.accent : t.raised)
      .on_click(this.on(fn))
      .child(div().absolute().top(2).left(on ? 18 : 2).size(12).rounded_full().bg(on ? t.accent_foreground : t.muted));
  }

  setting(t, id, title, sub, on, fn) {
    return h_flex().gap(12).py(8).items_center().border_b(1).border_color(t.border)
      .child(v_flex().flex_1().min_w(0).gap(1)
        .child(div().text_size(12).font_semibold().text_color(t.foreground).child(title))
        .child(div().text_size(10).text_color(t.muted).child(sub)))
      .child(this.toggle(t, id, on, fn));
  }

  field(t, state, w) {
    return div().w(w).flex_none().child(Input.new(state).h(30).px(9).rounded(7).border_1().border_color(t.input).bg(t.background).text_size(12).text_color(t.foreground));
  }

  render(cx) {
    const t = theme();
    const c = this.cfg;
    return v_flex().id("c-alerts").track_focus(this.handle).on_key_down((e, cx) => this.key(e, cx))
      .w_full().h_full().p(18).gap(10).bg(t.popover).text_color(t.foreground)
      .child(h_flex().items_center().gap(10)
        .child(div().text_size(15).font_semibold().child("Alerts"))
        .child(div().flex_1()).child(div().text_size(11).text_color(t.dim).child("Esc")))
      .child(v_flex().id("a-body").flex_1().min_h(0).overflow_y_scrollbar().pr(6).gap(2)
        .child(div().pb(4).text_size(12).text_color(t.muted).child("Conduct tells you when an agent newly becomes blocked, errors or looks stuck (not the one you are looking at, not a primary's own state), at most once per agent every 2 minutes. Three or more at once become a single alert."))
        .child(this.setting(t, "a-on", "Alerts", "Master switch for everything below.", c.enabled, () => this.set("enabled", !c.enabled)))
        .child(this.setting(t, "a-toast", "In-app toast", "A banner that opens the inbox when clicked.", c.toast, () => this.set("toast", !c.toast)))
        .child(this.setting(t, "a-sound", "Sound", "Plays Herdr's \"blocked\" sound (\"done\" for agents you chose to watch). Herdr already plays its own attention sounds; leave this off unless you silenced those.", c.sound, () => this.set("sound", !c.sound)))
        .child(this.setting(t, "a-quiet", "Quiet hours", "No alerts of any kind between these times (they may cross midnight).", c.quiet.on, () => this.save({ ...c, quiet: { ...c.quiet, on: !c.quiet.on } })))
        .child(h_flex().gap(8).py(8).items_center()
          .child(div().text_size(11).text_color(t.dim).child("From")).child(this.field(t, this.from, 80))
          .child(div().text_size(11).text_color(t.dim).child("to")).child(this.field(t, this.to, 80))
          .child(this.btn(t, "a-qsave", "Save", () => this.saveQuiet())))
        .when(Boolean(this.err.quiet), (d) => d.child(div().text_size(10).text_color(t.blocked).child(this.err.quiet)))
        .child(v_flex().gap(8).mt(14).p(12).rounded(10).border_1().border_color(c.push.on ? t.blocked : t.border).bg(t.surface)
          .child(h_flex().gap(12).items_center()
            .child(div().flex_1().text_size(13).font_semibold().text_color(t.foreground).child("Phone / desktop push (ntfy.sh)"))
            .child(div().text_size(10).text_color(t.dim).child(c.push.on ? "ON" : "OFF"))
            .child(this.toggle(t, "a-push", c.push.on, () => this.setPush(!c.push.on))))
          .child(div().text_size(11).font_semibold().text_color(t.blocked).child("Read this first: turning this on sends each alert's agent title and its one-line message to ntfy.sh, a third-party server, over the internet."))
          .child(div().text_size(11).text_color(t.muted).child("The topic below works like a password: anyone who knows it can read your alerts and send you fake ones. Use a long random one (the Generate button makes one), and never a guessable word. Install the ntfy app (or open ntfy.sh/<topic>) and subscribe to the same topic. Off by default; nothing is sent while it is off."))
          .child(h_flex().gap(8).items_center()
            .child(div().text_size(11).text_color(t.dim).child("Topic"))
            .child(div().flex_1().min_w(0).child(Input.new(this.topic).h(30).px(9).rounded(7).border_1().border_color(t.input).bg(t.background).text_size(12).text_color(t.foreground)))
            .child(this.btn(t, "a-gen", "Generate", () => this.suggest()))
            .child(this.btn(t, "a-tsave", "Save", () => this.saveTopic())))
          .when(Boolean(this.err.topic), (d) => d.child(div().text_size(10).text_color(t.blocked).child(this.err.topic)))
          .child(h_flex().gap(10).items_center()
            .child(this.btn(t, "a-test", this.busy ? "Sending…" : "Send test notification", () => this.test(), true))
            .child(div().flex_1().text_size(10).text_color(this.msg?.ok ? t.done : t.blocked).child(this.msg?.text ?? "The test sends a fixed sentence, no agent data."))))
      );
  }
}
