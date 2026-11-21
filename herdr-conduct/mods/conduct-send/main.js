// Conduct layout: type to an agent without leaving where you are.
//   mode "agent":   quick replies for one agent (yes / no / continue, status check) and a free-text line
//   mode "primary": the NUDGE: a message asking a primary agent to check on its sub-agents, listing the ones
//                   that need attention. Edit it, then send. Props: { mode, address? }

import { View, div } from "gpui-kit";
import { v_flex, h_flex, InputState, Input, TextareaState, Textarea } from "gpui-base";
import { props, closeOverlay, notify, theme } from "herdr";
import { NAME, colorOf, ink, model, nudgeText, send, interrupt, age } from "./attn.js";

const REPLIES = {
  blocked: ["Yes, go ahead.", "No, don't do that.", "Continue.", "Skip that and move on."],
  default: ["What's your status? Reply in one line.", "You seem stuck. Say what's blocking you, or continue.", "Continue."],
};

export default class ConductSend extends View {
  init(_p, cx) {
    const p = props() ?? {};
    this.mode = p.mode;
    this.target = p.address ?? null;
    if (this.mode === "primary") {
      const m = model();
      if (!this.target || !m.nodes.has(this.target)) this.target = m.primaries[0]?.address ?? null;
    }
    this.focused = true;
    this.fill(cx);
    this.handle = cx.focus_handle();
  }

  // (Re)build the text line: for a primary, with the message for whoever is chosen.
  fill(cx) {
    const m = model();
    const text = this.mode === "primary" && this.target ? nudgeText(m.nodes.get(this.target), m.nodes) : "";
    this.text = text;
    this.input = this.mode === "primary" ? TextareaState.new({ value: text, rows: 12 }) : InputState.new({ value: text });
    this.input.on("change", (_e, cx) => { this.text = this.input.value(); cx.notify(); });
    this.input.on("submit", () => this.go());
    this.input.on("focus", (_e, cx) => { this.focused = true; cx.notify(); });
    this.input.on("blur", (_e, cx) => { this.focused = false; cx.notify(); });
    this.input.focus();
    cx.timer.after(400, () => this.input.focus());
  }

  async deliver(text) {
    const m = model();
    const n = m.nodes.get(this.target);
    closeOverlay(props().overlay);
    if (!n || !text.trim()) return;
    const ok = await send(n.address, text.trim());
    notify({ title: ok ? `Sent to ${n.title}` : `Couldn't send to ${n.title}`, body: text.trim().slice(0, 120), level: ok ? "success" : "error", timeout: 3000 });
  }

  go() { this.deliver(this.text); }

  key(e, cx) {
    if (e.key === "escape") { closeOverlay(props().overlay); cx.stop_propagation(); }
    else if (e.keystroke === "ctrl-enter") { this.go(); cx.stop_propagation(); }
  }

  btn(t, id, text, primary, action) {
    return h_flex().id(id).h(30).px(13).items_center().rounded(8).cursor_pointer().text_size(12).font_medium()
      .border_1().border_color(primary ? t.solid : t.input)
      .bg(primary ? t.solid : t.raised).text_color(primary ? t.solid_foreground : t.foreground)
      .hover((s) => s.opacity(0.88)).on_click(action).child(text);
  }

  render(cx) {
    const t = theme();
    const m = model();
    const n = this.target ? m.nodes.get(this.target) : null;
    const color = n ? colorOf(t, n.status) : t.dim;
    const isPrimary = this.mode === "primary";
    const replies = n ? REPLIES[n.status] ?? REPLIES.default : [];
    return v_flex().id("c-send").track_focus(this.handle).on_key_down((e, cx) => this.key(e, cx))
      .w_full().p(18).gap(10).bg(t.popover).text_color(t.foreground)
      .child(
        h_flex().items_center()
          .child(div().flex_1().text_size(15).font_semibold().child(isPrimary ? "Nudge a primary agent" : "Reply to agent"))
          .child(div().text_size(11).text_color(t.dim).child("Esc")),
      )
      // Which primary: a pick when there is more than one.
      .when(isPrimary && m.primaries.length > 1, (el) =>
        el.child(
          h_flex().gap(6).flex_wrap().children(
            m.primaries.map((p) =>
              this.btn(t, `c-pick-${p.address}`, p.title, p.address === this.target, (_e, cx) => { this.target = p.address; this.fill(cx); cx.notify(); }),
            ),
          ),
        ),
      )
      .when(isPrimary && !n, (el) => el.child(div().text_size(12).text_color(t.dim).child("No primary agent: nothing here has started sub-agents yet.")))
      .when(Boolean(n), (el) =>
        el.child(
          h_flex().gap(8).items_center()
            .child(div().flex_none().h(18).px(7).flex().items_center().rounded(9).text_size(9).font_semibold().bg(color).text_color(ink(color)).child(NAME[n.status]))
            .child(div().flex_1().min_w(0).truncate().text_size(12).font_semibold().child(n.title))
            .child(div().flex_none().text_size(10).text_color(t.dim).child(age(n.since))),
        ),
      )
      .when(Boolean(n?.msg) && !isPrimary, (el) => el.child(div().text_size(11).text_color(t.muted).child(n.msg)))
      // Quick replies (single agent).
      .when(!isPrimary && Boolean(n), (el) =>
        el.child(
          h_flex().gap(6).flex_wrap().children([
            ...replies.map((r, i) => this.btn(t, `c-q-${i}`, r, false, () => this.deliver(r))),
            ...(n.raw === "working" ? [this.btn(t, "c-int", "Interrupt (stop key)", false, async () => { closeOverlay(props().overlay); await interrupt(n.address); })] : []),
          ]),
        ),
      )
      .when(Boolean(n), (el) =>
        el
          .child(div().pt(4).text_size(11).text_color(t.dim).child(isPrimary ? "Message to send (Ctrl+Enter sends)" : "Or type your own"))
          .child((isPrimary ? Textarea.new(this.input).h(250).py(8) : Input.new(this.input).h(36)).px(10).rounded(9).border_1().border_color(this.focused ? t.accent : t.input).bg(t.background).text_size(12.5).text_color(t.foreground))
          .child(
            h_flex().pt(6).gap(8).justify_end()
              .child(this.btn(t, "c-cancel", "Cancel", false, () => closeOverlay(props().overlay)))
              .child(this.btn(t, "c-go", isPrimary ? "Send nudge" : "Send", true, () => this.go())),
          ),
      );
  }
}
