// Conduct layout: triage. An inbox of only the critical states (blocked, error, stuck), one card at a time,
// like swiping through Slack unreads, but on hotkeys:
//   →  / r   mark read         the agent stays as it is; it comes back if its state changes
//   ←  / u   leave unread      on to the next one, this one stays in the inbox
//   i / enter  reply inline    type, Enter sends it and marks it read; Esc backs out
//   1-4      quick replies     (blocked: yes / no / continue / skip)
//   a Claude question (AskUserQuestion) is drawn as a form: click an option, or press its number (single select picks it,
//            multi select toggles it); Enter continues / submits; v shows the raw screen instead
//   o        open its terminal (marks read)   n  nudge its primary   d  also show finished (REVIEW)   Esc / q  close
// "Read" is the same mark the sidebar's NEW tag uses.

import { View, div } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import { props, closeOverlay, openOverlay, hc, notify, theme, shared, setShared } from "herdr";
import { NAME, CRITICAL, colorOf, ink, sorted, model, markSeen, go, send, press, age, halo } from "./attn.js";
import { parseForm } from "./form.js";

const QUICK = { blocked: ["Yes, go ahead.", "No, don't do that.", "Continue.", "Skip that and move on."], default: ["What's your status? One line.", "You seem stuck. Say what's blocking you, or continue.", "Continue."] };

export default class ConductTriage extends View {
  init(_p, cx) {
    this.cur = null;
    this.typing = false;
    this.review = false; // also show REVIEW (finished) items
    this.tails = new Map(); // address -> last lines of its screen
    this.forms = new Map(); // address -> the question form on its screen, if it shows one
    this.opt = new Map(); // address -> { q, set, ts }: what was just clicked, shown at once until the screen confirms
    this.raw = false; // v: show the screen instead of the form
    this.otherFor = null; // the "Type something" option the reply line is answering
    const want = shared("conduct.triage_focus");
    if (want) { this.cur = want; setShared("conduct.triage_focus", null); }
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
      const form = parseForm(r.stdout);
      this.forms.set(address, form);
      const o = this.opt.get(address);
      if (o && (Date.now() - o.ts > 400 || form?.question !== o.q)) this.opt.delete(address);
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
    this.otherFor = null;
    this.handle.focus();
    cx.notify();
  }

  async reply(text) {
    const n = this.now();
    if (!n || !text.trim()) return;
    const { q } = this.queue();
    if (this.otherFor != null) {
      // "Type something": pick that option, then type the answer into the field it opens.
      const num = this.otherFor;
      this.otherFor = null;
      await press(n.address, String(num));
      await new Promise((r) => this.cx.timer.after(450, () => r()));
    }
    const ok = await send(n.address, text.trim());
    notify({ title: ok ? `Sent to ${n.title}` : `Couldn't send to ${n.title}`, body: text.trim().slice(0, 100), level: ok ? "success" : "error", timeout: 2500 });
    if (ok) this.step(n, q, true, this.cx);
  }

  // Answer the form the way the terminal would: a digit. Then look again.
  choose(n, form, num) {
    const opt = form.options.find((o) => o.n === num);
    if (!opt) return;
    if (form.step === "question" && opt.other && !form.multi) { this.otherFor = num; this.input.focus(); this.cx.notify(); return; }
    if (form.step === "question") {
      // Show the click at once; the terminal catches up in a moment.
      const cur = this.opt.get(n.address);
      const base = cur && cur.q === form.question ? new Set(cur.set) : new Set(form.options.filter((o) => o.checked).map((o) => o.n));
      if (form.multi) base.has(num) ? base.delete(num) : base.add(num);
      else { base.clear(); base.add(num); }
      this.opt.set(n.address, { q: form.question, set: base, ts: Date.now() });
      this.cx.notify();
    }
    press(n.address, String(num));
    if (form.step === "review" && num === 1) markSeen(n);
    this.look(n);
  }

  look(n) {
    for (const ms of [120, 350, 800]) this.cx.timer.after(ms, (cx) => this.loadTail(n.address, cx));
  }

  advance(n, form) {
    if (form.step === "review") this.choose(n, form, 1);
    else if (form.multi) { press(n.address, "right"); this.look(n); }
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
      case "i": if (n) this.input.focus(); return stop();
      case "enter": {
        const form = n && this.forms.get(n.address);
        if (form && (form.step === "review" || form.multi)) this.advance(n, form);
        else if (n) this.input.focus();
        return stop();
      }
      case "v": this.raw = !this.raw; cx.notify(); return stop();
      case "b": { const f = n && this.forms.get(n.address); if (f?.tabs) { press(n.address, "left"); this.look(n); } return stop(); }
      case "o": if (n) { closeOverlay(props().overlay); go(n); } return stop();
      case "n": {
        const p = n?.parent;
        closeOverlay(props().overlay);
        openOverlay({ mod: "conduct-send", kind: "dialog", width: 600, props: { mode: "primary", address: p ?? undefined } });
        return stop();
      }
      case "d": this.review = !this.review; cx.notify(); return stop();
      case "escape": case "q": case "t": closeOverlay(props().overlay); return stop();
      case "1": case "2": case "3": case "4": case "5": case "6": case "7": case "8": case "9": {
        const form = n && !this.raw && this.forms.get(n.address);
        if (form) { this.choose(n, form, Number(e.key)); return stop(); }
        if (Number(e.key) > 4) return stop();
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

  // The question, as a form in the app's own font.
  formView(t, n, form, color) {
    const pend = this.opt.get(n.address);
    const opt = (o) => {
      const on = pend && pend.q === form.question ? pend.set.has(o.n) : o.checked;
      const mark = form.multi
        ? div().flex_none().size(16).rounded(4).border_1().border_color(on ? color : t.input).when(on, (d) => d.bg(color)).flex().items_center().justify_center().text_size(11).text_color(ink(color)).child(on ? "✓" : "")
        : div().flex_none().size(16).rounded_full().border_1().border_color(this.otherFor === o.n ? color : t.input).flex().items_center().justify_center().when(this.otherFor === o.n, (d) => d.child(div().size(8).rounded_full().bg(color)));
      return h_flex().id(`c-o-${o.n}`).gap(10).items_start().px(10).py(8).rounded(8).cursor_pointer()
        .border_1().border_color(on || this.otherFor === o.n ? color : t.border).bg(on ? color + "22" : t.surface)
        .hover((x) => x.border_color(color))
        .on_click(() => this.choose(n, form, o.n))
        .child(div().flex_none().h(16).flex().items_center().child(mark))
        .child(
          v_flex().flex_1().min_w(0).gap(2)
            .child(div().text_size(13).font_semibold().text_color(t.foreground).child(o.other ? "Something else…" : o.label))
            .when(Boolean(o.desc), (d) => d.child(div().text_size(11).text_color(t.muted).child(o.desc))),
        )
        .child(div().flex_none().h(18).px(6).flex().items_center().rounded(4).bg(t.raised).text_size(10).font_semibold().text_color(t.dim).child(String(o.n)));
    };
    const btn = (id, label, primary, fn) => h_flex().id(id).h(30).px(14).items_center().rounded(8).cursor_pointer().text_size(12).font_semibold()
      .border_1().border_color(primary ? color : t.input).bg(primary ? color : t.raised).text_color(primary ? ink(color) : t.foreground)
      .hover((x) => x.opacity(0.88)).on_click(fn).child(label);
    const canBack = Boolean(form.tabs && form.tabs.some((x) => x.done)); // not on the first question
    return v_flex().flex_1().min_h(0).overflow_y_scrollbar().gap(8)
      .when(Boolean(form.tabs), (el) =>
        el.child(h_flex().gap(6).flex_wrap().children(form.tabs.map((x) =>
          div().h(20).px(8).flex().items_center().rounded(10).text_size(10).font_semibold()
            .border_1().border_color(x.done ? color : t.border).when(x.done, (d) => d.bg(color).text_color(ink(color))).when(!x.done, (d) => d.text_color(t.dim))
            .child(`${x.done ? "✓ " : ""}${x.label}`)))))
      .when(form.step === "question", (el) =>
        el
          .when(Boolean(form.header && !form.tabs), (d) => d.child(div().text_size(10).font_semibold().text_color(t.dim).child(form.header.toUpperCase())))
          .child(div().text_size(15).font_semibold().text_color(t.foreground).child(form.question || "(question)"))
          .when(form.multi, (d) => d.child(div().text_size(11).text_color(t.dim).child("Choose any number")))
          .children(form.options.filter((o) => !(form.multi && o.other)).map(opt))
          .when(this.otherFor != null, (d) => d.child(div().text_size(11).text_color(color).child("Type your answer below and press Enter.")))
          .when(form.multi || canBack, (d) => d.child(
            h_flex().gap(8).pt(2)
              .when(form.multi, (r) => r.child(btn("c-cont", "Continue", true, () => this.advance(n, form))))
              .when(canBack, (r) => r.child(btn("c-back", "← Back", false, () => { press(n.address, "left"); this.look(n); }))))))
      .when(form.step === "review", (el) =>
        el
          .child(div().text_size(15).font_semibold().text_color(t.foreground).child("Review your answers"))
          .children(form.answers.map((a) =>
            v_flex().gap(2).p(10).rounded(8).bg(t.surface).border_1().border_color(t.border)
              .child(div().text_size(11).text_color(t.dim).child(a.q))
              .child(div().text_size(13).font_semibold().text_color(t.foreground).child(a.a))))
          .child(h_flex().gap(8).pt(2)
            .child(btn("c-submit", "Submit answers", true, () => this.choose(n, form, 1)))
            .child(btn("c-cancelq", "Cancel", false, () => this.choose(n, form, 2)))
            .child(btn("c-backr", "← Back", false, () => { press(n.address, "left"); this.look(n); }))));
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
    const form = n && !this.raw ? this.forms.get(n.address) : null;
    return v_flex().id("c-triage").track_focus(this.handle).on_key_down((e, cx) => this.key(e, cx))
      .w_full().h_full().p(18).gap(12).bg(t.popover).text_color(t.foreground)
      .border_t(3).border_color(n ? color : t.border)
      .child(
        h_flex().items_center().gap(10)
          .child(div().text_size(15).font_semibold().child("Triage"))
          .child(
            n
              ? div().h(18).px(8).flex().items_center().rounded(9).text_size(10).font_semibold().bg(color).text_color(ink(color)).child(`${idx + 1} of ${q.length} unread`)
              : div().text_size(11).text_color(t.dim).child("inbox zero"),
          )
          // One dot per unread, in its own color; the one you're on is larger.
          .child(h_flex().gap(4).items_center().children(q.slice(0, 24).map((x) => {
            const here = x.address === n?.address;
            return div().flex_none().size(here ? 10 : 6).rounded_full().bg(colorOf(t, x.status)).when(here, (d) => d.loop("opacity", { from: 0.5, to: 1, period: 900 }));
          })))
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
                  .when(Boolean(n.msg || n.kind) && !form, (el) => el.child(div().text_size(12).text_color(t.foreground).child(n.msg || `waiting: ${n.kind}`))),
              )
              .child(
                form ? this.formView(t, n, form, color) :
                v_flex().flex_1().min_h(0).overflow_hidden().p(10).rounded(6).bg(t.background).border_1().border_color(t.border).justify_end()
                  .children(tail.length ? tail.map((l) => div().truncate().text_size(11).text_color(t.muted).child(l)) : [div().text_size(11).text_color(t.dim).child("(reading its screen…)")]),
              )
              .when(!form, (el) => el.child(
                h_flex().gap(6).flex_wrap().children(quick.map((r, i) => this.hint(t, String(i + 1), r))),
              ))
              .child(
                h_flex().gap(8).items_center()
                  .child(div().flex_none().text_size(11).text_color(this.otherFor != null ? color : t.dim).child(this.otherFor != null ? "your answer" : "reply"))
                  .child(
                    div().flex_1().child(
                      Input.new(this.input).h(34).px(10).rounded(8).border_1()
                        .border_color(this.typing ? t.accent : t.input).bg(t.background).text_size(12).text_color(t.foreground),
                    ),
                  ),
              )
          : v_flex().flex_1().items_center().justify_center().gap(6)
              .child(div().text_size(18).font_semibold().child("Inbox zero"))
              .child(div().text_size(12).text_color(t.dim).child("Nothing critical is unread. It comes back here if a state changes."))
              .when(!this.review && m.list.some((x) => x.status === "done" && x.unseen), (el) =>
                el.child(div().pt(8).text_size(12).font_semibold().text_color(colorOf(t, "done")).child(`${m.list.filter((x) => x.status === "done" && x.unseen).length} finished and unread: press d`))),
      )
      .child(
        h_flex().gap(14).flex_wrap().pt(4)
          .child(this.hint(t, "→ / r", "mark read"))
          .child(this.hint(t, "← / u", "leave unread"))
          .child(this.hint(t, "i", "reply"))
          .child(this.hint(t, "o", "open"))
          .child(this.hint(t, "n", "nudge primary"))
          .child(this.hint(t, "d", "+review"))
          .child(this.hint(t, "v", "raw screen")),
      );
  }
}
