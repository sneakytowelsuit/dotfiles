// Conduct layout: triage. An inbox of only the critical states (blocked, error, stuck), one card at a time,
// like swiping through Slack unreads, but on hotkeys:
//   →  / r   mark read         the agent stays as it is; it comes back if its state changes
//   ←  / u   leave unread      on to the next one, this one stays in the inbox
//   i / enter  reply inline    type, Enter sends it and marks it read; Esc backs out
//   1-4      quick replies     (blocked: yes / no / continue / skip)
//   o        open its terminal (marks read)   n  nudge its primary   d  also show finished (REVIEW)   Esc / q  close
// "Read" is the same mark the sidebar's NEW tag uses.

import { View, div } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import { props, closeOverlay, openOverlay, hc, notify, theme } from "herdr";
import { NAME, CRITICAL, colorOf, ink, sorted, model, markSeen, go, send, age, halo } from "./attn.js";

const QUICK = { blocked: ["Yes, go ahead.", "No, don't do that.", "Continue.", "Skip that and move on."], default: ["What's your status? One line.", "You seem stuck. Say what's blocking you, or continue.", "Continue."] };

export default class ConductTriage extends View {
  init(_p, cx) {
    this.cur = null;
    this.typing = false;
    this.review = false; // also show REVIEW (finished) items
    this.tails = new Map(); // address -> last lines of its screen
    this.handle = cx.focus_handle();
    this.mkInput(cx);
    cx.timer.after(150, () => this.handle.focus());
    cx.timer.every(4000, (cx) => { const n = this.now(); if (n) this.loadTail(n.address, cx); cx.notify(); });
  }

  mkInput(cx) {
    this.text = "";
    this.input = InputState.new({ value: "" });
    this.input.on("change", (_e, cx) => { this.text = this.input.value(); cx.notify(); });
    this.input.on("submit", () => this.reply(this.text));
    this.input.on("focus", (_e, cx) => { this.typing = true; cx.notify(); });
    this.input.on("blur", (_e, cx) => { this.typing = false; cx.notify(); });
  }

  queue() {
    const m = model();
    const kinds = this.review ? [...CRITICAL, "done"] : CRITICAL;
    return { m, q: sorted(m.list).filter((n) => kinds.includes(n.status) && n.unseen) };
  }

  now() {
    const { q } = this.queue();
    return q.find((n) => n.address === this.cur) ?? q[0] ?? null;
  }

  loadTail(address, cx) {
    cx.spawn(async (cx) => {
      let r;
      try { r = await hc(["read", address]); } catch { return; }
      if (r.code !== 0) return;
      const lines = r.stdout.split("\n").map((l) => l.replace(/\s+$/, "")).filter((l) => l.trim());
      this.tails.set(address, lines.slice(-12));
      cx.notify();
    });
  }

  // Move on from n: to the next in the inbox (wrapping), or nothing if it was the last.
  step(n, q, read, cx) {
    const i = q.findIndex((x) => x.address === n.address);
    const rest = read ? q.filter((x) => x.address !== n.address) : q;
    this.cur = rest.length ? rest[(read ? i : i + 1) % rest.length]?.address ?? rest[0].address : null;
    if (read) markSeen(n);
    this.input.set_value("");
    this.text = "";
    this.handle.focus();
    cx.notify();
  }

  async reply(text) {
    const n = this.now();
    if (!n || !text.trim()) return;
    const { q } = this.queue();
    const ok = await send(n.address, text.trim());
    notify({ title: ok ? `Sent to ${n.title}` : `Couldn't send to ${n.title}`, body: text.trim().slice(0, 100), level: ok ? "success" : "error", timeout: 2500 });
    if (ok) this.step(n, q, true, this.cx);
  }

  key(e, cx) {
    this.cx = cx;
    const n = this.now();
    const { q } = this.queue();
    if (this.typing) {
      if (e.key === "escape") { this.handle.focus(); cx.stop_propagation(); }
      return;
    }
    const stop = () => cx.stop_propagation();
    switch (e.key) {
      case "right": case "r": if (n) this.step(n, q, true, cx); return stop();
      case "left": case "u": if (n) this.step(n, q, false, cx); return stop();
      case "i": case "enter": if (n) { this.input.focus(); } return stop();
      case "o": if (n) { closeOverlay(props().overlay); go(n); } return stop();
      case "n": {
        const p = n?.parent;
        closeOverlay(props().overlay);
        openOverlay({ mod: "conduct-send", kind: "dialog", width: 600, props: { mode: "primary", address: p ?? undefined } });
        return stop();
      }
      case "d": this.review = !this.review; cx.notify(); return stop();
      case "escape": case "q": case "t": closeOverlay(props().overlay); return stop();
      case "1": case "2": case "3": case "4": {
        const r = n && (QUICK[n.status] ?? QUICK.default)[Number(e.key) - 1];
        if (r) this.reply(r);
        return stop();
      }
    }
  }

  hint(t, k, label) {
    return h_flex().gap(5).items_center()
      .child(div().h(18).px(6).flex().items_center().rounded(4).bg(t.raised).border_1().border_color(t.border).text_size(10).font_semibold().text_color(t.foreground).child(k))
      .child(div().text_size(10).text_color(t.dim).child(label));
  }

  render(cx) {
    this.cx = cx;
    const t = theme();
    const { m, q } = this.queue();
    const n = this.now();
    if (n && this.cur !== n.address) this.cur = n.address;
    if (n && !this.tails.has(n.address)) { this.tails.set(n.address, []); this.loadTail(n.address, cx); }
    const color = n ? colorOf(t, n.status) : t.accent;
    const idx = n ? q.findIndex((x) => x.address === n.address) : 0;
    const parent = n?.parent ? m.nodes.get(n.parent) : null;
    const quick = n ? QUICK[n.status] ?? QUICK.default : [];
    const tail = n ? this.tails.get(n.address) ?? [] : [];
    return v_flex().id("c-triage").track_focus(this.handle).on_key_down((e, cx) => this.key(e, cx))
      .w_full().h_full().p(18).gap(12).bg(t.popover).text_color(t.foreground)
      .child(
        h_flex().items_center().gap(10)
          .child(div().text_size(15).font_semibold().child("Triage"))
          .child(div().text_size(11).text_color(t.dim).child(n ? `${idx + 1} of ${q.length} unread` : "inbox zero"))
          .child(div().flex_1())
          .child(div().text_size(10).text_color(this.review ? t.accent : t.dim).child(this.review ? "critical + review" : "critical only"))
          .child(div().text_size(11).text_color(t.dim).child("Esc")),
      )
      .child(
        n
          ? v_flex().gap(10).flex_1().min_h(0)
              .child(
                v_flex().gap(8).p(14).rounded(8).border_1().border_color(color).bg(color + "1f")
                  .child(
                    h_flex().gap(10).items_center()
                      .child(div().flex_none().h(20).px(9).flex().items_center().rounded(10).text_size(10).font_semibold().bg(color).text_color(ink(color)).child(NAME[n.status]))
                      .child(div().flex_1().min_w(0).truncate().text_size(16).font_semibold().child(n.title))
                      .child(div().flex_none().text_size(11).text_color(t.muted).child(age(n.since))),
                  )
                  .child(div().text_size(11).text_color(t.dim).child(`${parent ? `↳ ${parent.title} · ` : ""}${n.address} · ${n.spaceName} / ${n.tabName}`))
                  .when(Boolean(n.msg || n.kind), (el) => el.child(div().text_size(12).text_color(t.foreground).child(n.msg || `waiting: ${n.kind}`))),
              )
              .child(
                v_flex().flex_1().min_h(0).overflow_hidden().p(10).rounded(6).bg(t.background).border_1().border_color(t.border).justify_end()
                  .children(tail.length ? tail.map((l) => div().truncate().text_size(11).text_color(t.muted).child(l)) : [div().text_size(11).text_color(t.dim).child("(reading its screen…)")]),
              )
              .child(
                h_flex().gap(6).flex_wrap().children(quick.map((r, i) => this.hint(t, String(i + 1), r))),
              )
              .child(
                h_flex().gap(8).items_center()
                  .child(div().flex_none().text_size(11).text_color(t.dim).child("reply"))
                  .child(
                    div().flex_1().child(
                      Input.new(this.input).h(34).px(10).rounded(8).border_1()
                        .border_color(this.typing ? t.accent : t.input).bg(t.background).text_size(12).text_color(t.foreground),
                    ),
                  ),
              )
          : v_flex().flex_1().items_center().justify_center().gap(6)
              .child(div().text_size(18).font_semibold().child("Inbox zero"))
              .child(div().text_size(12).text_color(t.dim).child("Nothing critical is unread. It comes back here if a state changes.")),
      )
      .child(
        h_flex().gap(14).flex_wrap().pt(4)
          .child(this.hint(t, "→ / r", "mark read"))
          .child(this.hint(t, "← / u", "leave unread"))
          .child(this.hint(t, "i", "reply"))
          .child(this.hint(t, "o", "open"))
          .child(this.hint(t, "n", "nudge primary"))
          .child(this.hint(t, "d", "+review")),
      );
  }
}
