// Conduct layout: triage. An inbox of only the critical states (blocked, error, stuck), one card at a time,
// like swiping through Slack unreads, but on hotkeys:
//   →  / r   mark read         the agent stays as it is; it comes back if its state changes
//   ←  / u   leave unread      on to the next one, this one stays in the inbox
//   i / enter  reply inline    type, Enter sends it and marks it read; Esc backs out
//   1-4      quick replies     (blocked: yes / no / continue / skip)
//   a Claude question (AskUserQuestion) is drawn as a form: click an option, or press its number (single select picks it,
//            multi select toggles it); Enter continues / submits; v shows the raw screen instead
//   g / o    go to the agent (drops you into its terminal, marks read)   n  nudge its primary   d  also show finished (REVIEW)   Esc / q  close
// "Read" is the same mark the sidebar's NEW tag uses.

import { View, div } from "gpui-kit";
import { v_flex, h_flex, InputState, Input, TextareaState, Textarea } from "gpui-base";
import { props, closeOverlay, openOverlay, hc, notify, theme, shared, setShared, settings } from "herdr";
import { NAME, CRITICAL, colorOf, ink, sorted, model, markSeen, go, send, press, age, halo, noteAnswered } from "./attn.js";
import { parseForm, canType, keysFor } from "./form.js";
import { inboxAction, show } from "./keys.js";

const QUICK = { done: ["Thanks, looks good.", "Please continue.", "Summarize what you did in two lines."], blocked: ["Yes, go ahead.", "No, don't do that.", "Continue.", "Skip that and move on."], default: ["What's your status? One line.", "You seem stuck. Say what's blocking you, or continue.", "Continue."] };

export default class ConductTriage extends View {
  init(_p, cx) {
    this.cx = cx;
    this.cur = null;
    this.typing = false;
    this.finishedView = false; // d: the quiet list of finished agents instead of the inbox
    this.tails = new Map(); // address -> last lines of its screen
    this.forms = new Map(); // address -> the question form on its screen, if it shows one
    this.prev = new Map(); // "address|question" -> { option number: preview text }, for preview layouts
    this.peeked = new Set(); // "address|question" already walked through
    this.notesInput = InputState.new({ value: "" });
    this.notesText = "";
    this.notesInput.on("change", (_e, cx) => { this.notesText = this.notesInput.value(); cx.notify(); });
    this.notesInput.on("focus", (_e, cx) => { this.typing = true; this.typingNotes = true; cx.notify(); });
    this.notesInput.on("blur", (_e, cx) => { this.typing = false; this.typingNotes = false; cx.notify(); });
    this.qi = new Map(); // address -> index of the question the terminal is on (tabs.length = the review step)
    this.qtext = new Map(); // "address|index" -> that question's text, to re-find our place
    this.leave = null; // { address, action }: asked to leave an unfinished form, waiting for a second press
    this.flash = null; // { text, next, until }: what just went out, shown on the next card
    this.stage = new Map(); // address -> { q, n }: a single-select pick not yet sent (click it again to clear)
    this.opt = new Map(); // address -> { q, set, ts }: what was just clicked, shown at once until the screen confirms
    this.raw = false; // v: show the screen instead of the form
    this.otherFor = null; // the "Type something" option the reply line is answering
    const want = shared("conduct.triage_focus");
    if (want) { this.cur = want; setShared("conduct.triage_focus", null); }
    this.handle = cx.focus_handle();
    this.mkInput(cx);
    cx.timer.after(150, () => this.handle.focus());
    cx.timer.every(4000, (cx) => {
      if (this.finishedView) { for (const f of this.finishedList().slice(0, 12)) this.loadTail(f.address, cx); }
      else { const n = this.now(); if (n) this.loadTail(n.address, cx); }
      cx.notify();
    });
  }

  mkInput(cx) {
    this.text = "";
    this.input = TextareaState.new({ value: "", rows: 3, placeholder: "Reply… (Ctrl+Enter sends, Enter adds a line)" });
    this.input.set_auto_grow(3, 9);
    this.input.on("change", (_e, cx) => { this.text = this.input.value(); cx.notify(); });
    this.input.on("submit", () => this.reply(this.text));
    this.input.on("focus", (_e, cx) => { this.typing = true; cx.notify(); });
    this.input.on("blur", (_e, cx) => { this.typing = false; cx.notify(); });
  }

  queue() {
    const m = model();
    const kinds = CRITICAL;
    const list = sorted(m.list).filter((n) => kinds.includes(n.status) && n.unseen);
    // One primary's agents stay together; groups ordered by their most urgent member.
    const g = (n) => n.parent ?? n.address;
    const first = new Map();
    list.forEach((n, i) => { if (!first.has(g(n))) first.set(g(n), i); });
    const q = list.map((n, i) => [n, i]).sort((a, b) => first.get(g(a[0])) - first.get(g(b[0])) || a[1] - b[1]).map((x) => x[0]);
    return { m, q };
  }

  // Finished and not yet read, newest first.
  finishedList() {
    return model().list.filter((n) => n.status === "done" && n.fresh).sort((a, b) => (b.since ?? 0) - (a.since ?? 0));
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
      if (form?.tabs) {
        const M = form.tabs.length;
        if (form.step === "review") this.qi.set(address, M);
        else {
          let at = null;
          for (let i = 0; i < M; i++) if (this.qtext.get(`${address}|${i}`) === form.question) { at = i; break; }
          if (at == null) { at = this.qi.get(address); if (at == null || at >= M) at = Math.max(0, form.tabs.findIndex((x) => !x.done)); }
          this.qi.set(address, at);
          this.qtext.set(`${address}|${at}`, form.question);
        }
      } else if (!form) this.qi.delete(address);
      const o = this.opt.get(address);
      if (o && (Date.now() - o.ts > 400 || form?.question !== o.q)) this.opt.delete(address);
      if (form?.preview != null && form.cursor != null) {
        const key = `${address}|${form.question}`;
        const seen = this.prev.get(key) ?? {};
        seen[form.cursor] = form.preview;
        this.prev.set(key, seen);
        if (!this.peeked.has(key) && form.options.some((x) => seen[x.n] === undefined)) { this.peeked.add(key); this.peek(address, form, key); }
      }
      cx.notify();
    });
  }

  wait(ms) { return new Promise((r) => this.cx.timer.after(ms, () => r())); }

  // A preview layout only draws the highlighted option's preview, so move through the others once to read theirs,
  // then put the highlight back.
  async peek(address, form, key) {
    const home = form.cursor;
    for (const o of form.options) {
      if (o.n === home || this.prev.get(key)?.[o.n] !== undefined) continue;
      await press(address, String(o.n));
      await this.wait(170);
      const r = await hc(["read", address]);
      const f = r.code === 0 ? parseForm(r.stdout) : null;
      if (f?.preview != null && f.cursor != null) { const seen = this.prev.get(key) ?? {}; seen[f.cursor] = f.preview; this.prev.set(key, seen); this.cx.notify(); }
    }
    await press(address, String(home));
    this.look({ address });
  }

  // Type into the terminal: as key presses when every character has a key (clean text), else pasted with `hc send`,
  // which also presses Enter and tags the text for the receiving agent.
  async typeText(address, text) {
    if (!canType(text)) return false;
    const keys = keysFor(text);
    for (let i = 0; i < keys.length; i += 40) await press(address, ...keys.slice(i, i + 40));
    return true;
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
    if (this.otherFor != null) { await this.answerOther(n, q, text.trim()); return; }
    const ok = await send(n.address, text.trim());
    notify({ title: ok ? `Sent to ${n.title}` : `Couldn't send to ${n.title}`, body: text.trim().slice(0, 100), level: ok ? "success" : "error", timeout: 2500 });
    if (ok) this.step(n, q, true, this.cx);
  }

  // The typed answer for a "Type something" row. Single select: type it and Enter. Multi select: typing ticks the
  // row on its own, so type, then move off the row (Enter would untick it).
  async answerOther(n, q, text) {
    const form = this.forms.get(n.address);
    const multi = Boolean(form?.multi);
    this.otherFor = null;
    this.input.set_value("");
    this.text = "";
    this.handle.focus();
    if (await this.typeText(n.address, text)) {
      await press(n.address, multi ? "up" : "enter");
    } else {
      await send(n.address, text); // pasted: it also pressed Enter
      if (multi) { await press(n.address, "enter"); await press(n.address, "up"); } // Enter unticked it; tick it again
    }
    if (!multi) { if (form?.tabs) { this.bump(n, form, +1); this.cx.notify(); } else this.finishAgent(n, "1 answer"); }
    this.look(n);
  }

  // Preview layout: the highlighted option is the answer. Notes go in first (n, text, Esc), then Enter.
  async selectPreview(n, form, q) {
    const note = this.notesText.trim();
    if (note) {
      await press(n.address, "n");
      const typed = await this.typeText(n.address, note);
      await press(n.address, "esc");
      if (!typed) notify({ title: "Notes not sent", body: "Claude's notes box can't take some of those characters.", level: "warning", timeout: 4000 });
    }
    await press(n.address, "enter");
    this.notesInput.set_value("");
    this.notesText = "";
    if (form.tabs) { this.bump(n, form, +1); this.cx.notify(); } else this.finishAgent(n, "1 answer");
    this.look(n);
  }

  // Answer the form the way the terminal would: a digit. Then look again.
  choose(n, form, num) {
    const opt = form.options.find((o) => o.n === num);
    if (!opt) return;
    if (form.step === "question" && opt.other) {
      // Land on the "Type something" row (it opens for typing there), then take the answer from the reply line.
      this.otherFor = num;
      if (form.multi) { const d = num - (form.cursor ?? 1); for (let i = 0; i < Math.abs(d); i++) press(n.address, d > 0 ? "down" : "up"); }
      else press(n.address, String(num));
      this.input.focus();
      this.cx.notify();
      return;
    }
    if (form.preview != null) {
      // A digit only highlights here; Enter (or Choose) picks.
      this.opt.set(n.address, { q: form.question, set: new Set([num]), ts: Date.now() });
      press(n.address, String(num));
      this.cx.notify();
      this.look(n);
      return;
    }
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
    if (form.step === "review") { if (num === 1) this.finishAgent(n, `${form.answers.length} answer${form.answers.length === 1 ? "" : "s"}`); }
    else if (form.tabs && !form.multi) this.bump(n, form, +1); // answering moves the terminal to the next question
    else if (!form.tabs && !form.multi && form.preview == null) this.finishAgent(n, "1 answer");
    this.look(n);
  }

  look(n) {
    for (const ms of [120, 350, 800]) this.cx.timer.after(ms, (cx) => this.loadTail(n.address, cx));
  }

  advance(n, form) {
    if (form.step === "review") this.choose(n, form, 1);
    else if (form.multi) { if (form.inserting) press(n.address, "up"); press(n.address, "right"); this.bump(n, form, +1); this.look(n); this.cx.notify(); }
  }

  // Everything a hotkey does, by name, so the hint chips can run the same thing on a click.
  act(name) {
    const n = this.now();
    const { q } = this.queue();
    const form = n ? this.forms.get(n.address) : null;
    const cx = this.cx;
    switch (name) {
      case "read": case "leave": {
        if (!n) return;
        // An open form is unfinished: ask once before walking away from it.
        if (form && !(this.leave && this.leave.address === n.address && this.leave.action === name)) { this.leave = { address: n.address, action: name }; cx.notify(); return; }
        this.leave = null;
        this.step(n, q, name === "read", cx);
        return;
      }
      case "stay": this.leave = null; cx.notify(); return;
      case "reply": if (form?.preview != null) this.notesInput.focus(); else if (n) this.input.focus(); return;
      case "go": if (n) { closeOverlay(props().overlay); go(n); } return;
      case "nudge": {
        const p = n?.parent;
        closeOverlay(props().overlay);
        openOverlay({ mod: "conduct-send", kind: "dialog", width: 0.5, props: { mode: "primary", address: p ?? undefined } });
        return;
      }
      case "review": this.finishedView = !this.finishedView; if (this.finishedView) for (const f of this.finishedList().slice(0, 12)) this.loadTail(f.address, cx); cx.notify(); return;
      case "readall": for (const f of this.finishedList()) markSeen(f); cx.notify(); return;
      case "raw": this.raw = !this.raw; cx.notify(); return;
      case "back": if (n) this.back(n, form); return;
      case "skip": if (n && form?.tabs) { this.stage.delete(n.address); press(n.address, "right"); this.bump(n, form, +1); this.look(n); cx.notify(); } return;
      case "dismiss": if (n) { press(n.address, "esc"); this.look(n); } return;
      case "close": if (this.leave) { this.leave = null; cx.notify(); } else closeOverlay(props().overlay); return;
      case "enter":
        if (form?.preview != null) this.selectPreview(n, form, q);
        else if (form?.step === "review" || form?.multi) this.advance(n, form);
        else if (form) this.confirm(n, form);
        else if (n) this.input.focus();
        return;
    }
  }

  // Click on a single-select option: stage it (click again to clear). Enter / Confirm sends it; a digit sends at once.
  pick(n, form, num) {
    const cur = this.stage.get(n.address);
    if (cur && cur.q === form.question && cur.n === num) this.stage.delete(n.address);
    else this.stage.set(n.address, { q: form.question, n: num });
    this.cx.notify();
  }

  confirm(n, form) {
    const st = this.stage.get(n.address);
    if (st && st.q === form.question) { this.stage.delete(n.address); this.choose(n, form, st.n); }
    else if (form.tabs) this.act("skip");
  }

  bump(n, form, d) {
    const M = form.tabs ? form.tabs.length : 0;
    this.qi.set(n.address, Math.max(0, Math.min(M, (this.qi.get(n.address) ?? 0) + d)));
  }

  back(n, form) {
    if (!form?.tabs) return;
    press(n.address, "left");
    this.bump(n, form, -1);
    this.look(n);
    this.cx.notify();
  }

  // Go to question k (or the review step, k = tabs.length): to the first tab, then right k times.
  jump(n, form, k) {
    const M = form.tabs.length;
    const keys = [];
    if (form.inserting) keys.push("up");
    for (let i = 0; i < M; i++) keys.push("left");
    for (let i = 0; i < k; i++) keys.push("right");
    press(n.address, ...keys);
    this.qi.set(n.address, k);
    this.stage.delete(n.address);
    this.look(n);
    this.cx.notify();
  }

  // This agent's questions are all answered: say what went out, and go on to the next agent.
  finishAgent(n, what) {
    const { q } = this.queue();
    const i = q.findIndex((x) => x.address === n.address);
    const rest = q.filter((x) => x.address !== n.address);
    const next = rest.length ? rest[Math.max(0, i) % rest.length] : null;
    noteAnswered(n.address); // its next "finished" is the aftermath of this, not news
    this.flash = { text: `Sent ${what} to ${n.title}`, next: next ? next.title : null, until: Date.now() + 5000 };
    this.cx.timer.after(5200, (cx) => cx.notify());
    this.step(n, q, true, this.cx);
  }

  // Start the question over where Claude's menu allows it: untick everything in a multi select, or drop a staged pick.
  reset(n, form) {
    this.stage.delete(n.address);
    if (form.multi) {
      const pend = this.opt.get(n.address);
      const on = pend && pend.q === form.question ? [...pend.set] : form.options.filter((o) => o.checked).map((o) => o.n);
      for (const num of on) press(n.address, String(num));
      this.opt.set(n.address, { q: form.question, set: new Set(), ts: Date.now() });
      this.look(n);
    }
    this.cx.notify();
  }

  key(e, cx) {
    this.cx = cx;
    if (this.typing) {
      if (e.key === "escape") { this.handle.focus(); cx.stop_propagation(); }
      else if (e.keystroke === "ctrl-enter" && !this.typingNotes) { this.reply(this.text); cx.stop_propagation(); }
      return;
    }
    const stop = () => cx.stop_propagation();
    const id = inboxAction(e.keystroke);
    if (this.finishedView) {
      const fm = { read: "readall", review: "review", close: "close" };
      if (id && fm[id]) { this.act(fm[id]); return stop(); }
      return;
    }
    if (id) { this.act(id); return stop(); }
    if (/^[1-9]$/.test(e.key)) {
      const n = this.now();
      const form = n && !this.raw && this.forms.get(n.address);
      if (form) { this.stage.delete(n.address); this.choose(n, form, Number(e.key)); return stop(); }
      if (Number(e.key) > 4) return stop();
      const r = n && (QUICK[n.status] ?? QUICK.default)[Number(e.key) - 1];
      if (r) this.reply(r);
      return stop();
    }
  }

  hint(t, k, label, fn) {
    return h_flex().id(`c-h-${k}`).gap(5).items_center().cursor_pointer().rounded(5)
      .hover((x) => x.bg(t.hover))
      .on_click(this.on(fn))
      .child(div().h(18).px(6).flex().items_center().rounded(4).bg(t.raised).border_1().border_color(t.border).text_size(10).font_semibold().text_color(t.foreground).child(k))
      .child(div().text_size(10).text_color(t.dim).child(label));
  }

  // Which question we're on, and a way to jump to any of them.
  tabStrip(t, n, form, color) {
    const M = form.tabs.length;
    const at = form.step === "review" ? M : this.qi.get(n.address) ?? 0;
    const chip = (label, i, done, here) =>
      div().id(`c-tab-${i}`).h(22).px(9).flex().items_center().rounded(11).cursor_pointer().text_size(10).font_semibold()
        .border_1().border_color(here || done ? color : t.border)
        .when(here, (d) => d.bg(color).text_color(ink(color)))
        .when(!here && done, (d) => d.text_color(color))
        .when(!here && !done, (d) => d.text_color(t.dim))
        .hover((d) => d.border_color(color))
        .on_click(this.on(() => this.jump(n, form, i)))
        .child(`${done ? "✓ " : ""}${label}`);
    return v_flex().gap(6)
      .child(div().text_size(10).font_semibold().text_color(t.dim).child(at >= M ? "REVIEW" : `QUESTION ${at + 1} OF ${M}`))
      .child(h_flex().gap(6).flex_wrap().children([...form.tabs.map((x, i) => chip(x.label, i, x.done, i === at)), chip("Review", M, false, at === M)]));
  }

  // The question, as a form in the app's own font.
  formView(t, n, form, color) {
    const pend = this.opt.get(n.address);
    const st = this.stage.get(n.address);
    const staged = st && st.q === form.question ? st.n : null; // a single-select pick not sent yet
    const opt = (o) => {
      // In a preview layout the highlighted row is the choice; a staged pick beats what Claude reports; else what it ticked.
      const on = form.preview != null
        ? (pend && pend.q === form.question ? pend.set.has(o.n) : form.cursor === o.n)
        : staged != null && !form.multi ? staged === o.n
        : pend && pend.q === form.question ? pend.set.has(o.n) : o.checked;
      const mark = form.multi
        ? div().flex_none().size(16).rounded(4).border_1().border_color(on ? color : t.input).when(on, (d) => d.bg(color)).flex().items_center().justify_center().text_size(11).text_color(ink(color)).child(on ? "✓" : "")
        : div().flex_none().size(16).rounded_full().border_1().border_color(on ? color : t.input).flex().items_center().justify_center()
            .when(on || this.otherFor === o.n, (d) => d.child(div().size(8).rounded_full().bg(color)));
      return h_flex().id(`c-o-${o.n}`).gap(10).items_start().px(10).py(8).rounded(8).cursor_pointer()
        .border_1().border_color(on || this.otherFor === o.n ? color : t.border).bg(on ? color + "22" : t.surface)
        .hover((x) => x.border_color(color))
        .on_click(this.on(() => (form.multi || o.other || form.preview != null || form.step !== "question" ? this.choose(n, form, o.n) : this.pick(n, form, o.n))))
        .child(div().flex_none().h(16).flex().items_center().child(mark))
        .child(
          v_flex().flex_1().min_w(0).gap(2)
            .child(div().text_size(13).font_semibold().text_color(t.foreground).child(o.other && /^Type something/i.test(o.label) ? "Something else…" : o.label))
            .when(Boolean(o.desc), (d) => d.child(div().text_size(11).text_color(t.muted).child(o.desc))),
        )
        .child(div().flex_none().h(18).px(6).flex().items_center().rounded(4).bg(t.raised).text_size(10).font_semibold().text_color(t.dim).child(String(o.n)));
    };
    const btn = (id, label, primary, fn) => h_flex().id(id).h(30).px(14).items_center().rounded(8).cursor_pointer().text_size(12).font_semibold()
      .border_1().border_color(primary ? color : t.input).bg(primary ? color : t.raised).text_color(primary ? ink(color) : t.foreground)
      .hover((x) => x.opacity(0.88)).on_click(this.on(fn)).child(label);
    if (form.preview != null) {
      const seen = this.prev.get(`${n.address}|${form.question}`) ?? {};
      const here = pend && pend.q === form.question ? [...pend.set][0] : form.cursor;
      const shown = seen[here] ?? (here === form.cursor ? form.preview : undefined);
      const mono = settings()?.font_family ?? "monospace";
      const nb = (l) => l.replace(/ /g, "\u00a0");
      return v_flex().gap(10)
        .when(Boolean(form.tabs), (el) => el.child(this.tabStrip(t, n, form, color)))
        .child(div().text_size(15).font_semibold().text_color(t.foreground).child(form.question || "(question)"))
        .child(
          h_flex().gap(14).items_start()
            .child(v_flex().flex_none().w(230).gap(6).children(form.options.map(opt)))
            .child(
              v_flex().flex_1().min_w(0).gap(8)
                .child(
                  v_flex().p(12).rounded(8).bg(t.background).border_1().border_color(t.border).min_h(90)
                    .children(shown === undefined ? [div().text_size(11).text_color(t.dim).child("reading preview…")]
                      : shown.split("\n").map((l) => div().text_size(12).font_family(mono).text_color(t.foreground).child(nb(l) || "\u00a0"))),
                )
                .child(div().text_size(10).font_semibold().text_color(t.dim).child("NOTES (OPTIONAL, i TO TYPE)"))
                .child(Input.new(this.notesInput).h(32).px(10).rounded(8).border_1().border_color(this.typing ? color : t.input).bg(t.background).text_size(12).text_color(t.foreground))
                .when(this.notesText && !canType(this.notesText), (d) => d.child(div().text_size(10).text_color(t.dim).child("Some characters can't be typed into Claude's notes box and will be left out.")))
                .child(h_flex().gap(8).pt(2).child(btn("c-choose", "Choose this", true, () => this.selectPreview(n, form, this.queue().q)))),
            ),
        );
    }
    const nextUp = this.queue().q.length > 1;
    const ticked = form.multi && (pend && pend.q === form.question ? pend.set.size > 0 : form.options.some((o) => o.checked));
    const canBack = Boolean(form.tabs && form.tabs.some((x) => x.done)); // not on the first question
    return v_flex().gap(8)
      .when(Boolean(form.tabs), (el) => el.child(this.tabStrip(t, n, form, color)))
      .when(form.step === "question", (el) =>
        el
          .when(Boolean(form.header && !form.tabs), (d) => d.child(div().text_size(10).font_semibold().text_color(t.dim).child(form.header.toUpperCase())))
          .child(div().text_size(15).font_semibold().text_color(t.foreground).child(form.question || "(question)"))
          .when(form.multi, (d) => d.child(div().text_size(11).text_color(t.dim).child("Choose any number")))
          .children(form.options.filter((o) => !(form.multi && o.other)).map(opt))
          .when(this.otherFor != null, (d) => d.child(div().text_size(11).text_color(color).child("Type your answer below and press Enter.")))
          .when(!form.multi && staged == null && form.options.some((o) => o.checked && !o.other), (d) => d.child(
            div().text_size(10).text_color(t.dim).child("Already answered. Claude's menu can't clear a sent answer: pick another to change it, or skip.")))
          .child(
            h_flex().gap(8).pt(2).flex_wrap()
              .when(form.multi, (r) => r.child(btn("c-cont", ticked ? "Continue" : "Skip →", true, () => this.advance(n, form))))
              .when(!form.multi, (r) => r.child(staged != null
                ? btn("c-confirm", "Confirm", true, () => this.confirm(n, form))
                : form.tabs ? btn("c-skip", "Skip this question →", true, () => this.act("skip")) : btn("c-dismiss", "Dismiss question", false, () => this.act("dismiss"))))
              .when(staged != null || (form.multi && ticked), (r) => r.child(btn("c-reset", "Reset", false, () => this.reset(n, form))))
              .when(canBack, (r) => r.child(btn("c-back", "← Back", false, () => this.back(n, form))))))
      .when(form.step === "review", (el) =>
        el
          .child(div().text_size(15).font_semibold().text_color(t.foreground).child("Review your answers"))
          .when(form.unanswered, (d) => d.child(div().text_size(11).text_color(t.muted).child("Some questions are left unanswered: the agent can ask you about those next.")))
          .children(form.answers.map((a) =>
            v_flex().gap(2).p(10).rounded(8).bg(t.surface).border_1().border_color(t.border)
              .child(div().text_size(11).text_color(t.dim).child(a.q))
              .child(div().text_size(13).font_semibold().text_color(t.foreground).child(a.a))))
          .children((form.tabs ?? []).filter((x) => !x.done).map((x) =>
            v_flex().gap(2).p(10).rounded(8).border_1().border_color(t.border)
              .child(div().text_size(11).text_color(t.dim).child(x.label))
              .child(div().text_size(12).text_color(t.dim).child("not answered"))))
          .child(h_flex().gap(8).pt(2)
            .child(btn("c-submit", nextUp ? "Submit and go to next agent" : "Submit answers", true, () => this.choose(n, form, 1)))
            .child(btn("c-cancelq", "Cancel", false, () => this.choose(n, form, 2)))
            .child(btn("c-backr", "← Back", false, () => this.back(n, form)))));
  }

  // The quiet list: agents that finished while you were away. Information, not decisions: no cards, nothing pulses.
  finishedScreen(t, fin) {
    const color = colorOf(t, "done");
    // What the agent last said: its last "●" line, else its last real line.
    const said = (address) => {
      const lines = this.tails.get(address) ?? [];
      const bullet = [...lines].reverse().find((l) => /^\s*●\s+\S/.test(l));
      if (bullet) return bullet.replace(/^\s*●\s+/, "");
      const real = [...lines].reverse().find((l) => l.trim() && !/^\s*(─|❯|--|⏵|✻|\*|·)/.test(l) && !/(Baked|Cooked|Worked|Churned|Sautéed) for/.test(l));
      return real ? real.trim() : "";
    };
    const row = (f) =>
      h_flex().id(`c-fin-${f.address}`).gap(10).items_center().px(12).py(9).rounded(8).cursor_pointer()
        .border_1().border_color(t.border).bg(t.surface).hover((x) => x.border_color(color))
        .on_click(this.on(() => { markSeen(f); closeOverlay(props().overlay); go(f); }))
        .child(div().flex_none().size(8).rounded_full().border_1().border_color(color))
        .child(
          v_flex().flex_1().min_w(0).gap(2)
            .child(h_flex().gap(8).items_center().child(div().truncate().text_size(13).font_semibold().text_color(t.foreground).child(f.title)).child(div().flex_none().text_size(10).text_color(t.dim).child(f.name ?? f.address)))
            .child(div().truncate().text_size(11).text_color(t.muted).child(said(f.address) || "(reading its screen…)")),
        )
        .child(div().flex_none().text_size(10).text_color(t.dim).child(age(f.since)));
    return v_flex().id("c-triage").track_focus(this.handle).on_key_down((e, cx) => this.key(e, cx))
      .w_full().h_full().p(18).gap(12).bg(t.popover).text_color(t.foreground)
      .border_t(3).border_color(color)
      .child(
        h_flex().items_center().gap(10)
          .child(div().text_size(15).font_semibold().child("Finished"))
          .child(div().text_size(11).text_color(t.dim).child(fin.length ? `${fin.length} unread` : "nothing unread"))
          .child(div().flex_1())
          .child(div().text_size(10).text_color(t.dim).child("information only"))
          .child(div().text_size(11).text_color(t.dim).child("Esc")),
      )
      .child(
        v_flex().id("c-fin-body").flex_1().min_h(0).overflow_y_scrollbar().gap(8).pr(4)
          .children(fin.length ? fin.map(row) : [v_flex().items_center().py(60).gap(6).child(div().text_size(16).font_semibold().child("All caught up")).child(div().text_size(12).text_color(t.dim).child("Nothing has finished since you last looked."))]),
      )
      .child(
        h_flex().gap(14).flex_wrap().pt(4)
          .child(this.hint(t, show("read"), "mark all read", () => this.act("readall")))
          .child(this.hint(t, show("review"), "back to inbox", () => this.act("review")))
          .child(this.hint(t, show("close"), "close", () => this.act("close"))),
      );
  }

  // A click handler that remembers the context it was given, so notify() repaints at once.
  on(fn) { return (_e, cx) => { this.cx = cx; fn(); }; }

  render(cx) {
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
    const fin = this.finishedList();
    const nFin = fin.length;
    if (this.finishedView) return this.finishedScreen(t, fin);
    return v_flex().id("c-triage").track_focus(this.handle).on_key_down((e, cx) => this.key(e, cx))
      .w_full().h_full().p(18).gap(12).bg(t.popover).text_color(t.foreground)
      .border_t(3).border_color(n ? color : t.border)
      .child(
        h_flex().items_center().gap(10)
          .child(div().text_size(15).font_semibold().child("Triage"))
          .child(
            n
              ? div().h(18).px(8).flex().items_center().rounded(9).text_size(10).font_semibold().bg(color).text_color(ink(color)).child(`Agent ${idx + 1} of ${q.length}`)
              : div().text_size(11).text_color(t.dim).child("inbox zero"),
          )
          // One dot per unread, in its own color; the one you're on is larger.
          .child(h_flex().gap(4).items_center().children(q.slice(0, 24).map((x) => {
            const here = x.address === n?.address;
            return div().flex_none().size(here ? 10 : 6).rounded_full().bg(colorOf(t, x.status)).when(here, (d) => d.loop("opacity", { from: 0.5, to: 1, period: 900 }));
          })))
          .child(div().flex_1())
          .child(div().text_size(10).text_color(t.dim).child("needs you only"))
          .child(div().text_size(11).text_color(t.dim).child("Esc")),
      )
      .child(
        v_flex().id("c-body").flex_1().min_h(0).overflow_y_scrollbar().gap(12).pr(4)
      .when(Boolean(this.flash && Date.now() < this.flash.until), (el) =>
        el.child(h_flex().gap(8).items_center().px(12).py(8).rounded(8).bg(colorOf(t, "done") + "22").border_1().border_color(colorOf(t, "done"))
          .child(div().text_size(12).font_semibold().text_color(t.foreground).child(`✓ ${this.flash.text}`))
          .child(div().text_size(12).text_color(t.muted).child(this.flash.next ? `→ next: ${this.flash.next}` : "→ inbox clear"))))
      .when(Boolean(this.leave && n && this.leave.address === n.address), (el) =>
        el.child(h_flex().gap(10).items_center().px(12).py(8).rounded(8).bg(color + "22").border_1().border_color(color)
          .child(div().flex_1().text_size(12).text_color(t.foreground).child("This agent's questions aren't finished. Leave anyway?"))
          .child(h_flex().id("c-leave-go").h(26).px(11).items_center().rounded(8).cursor_pointer().text_size(11).font_semibold().bg(color).text_color(ink(color)).on_click(this.on(() => this.act(this.leave.action))).child(this.leave?.action === "read" ? "Mark read" : "Leave unread"))
          .child(h_flex().id("c-leave-stay").h(26).px(11).items_center().rounded(8).cursor_pointer().text_size(11).font_semibold().border_1().border_color(t.input).bg(t.raised).on_click(this.on(() => this.act("stay"))).child("Stay"))))
      .child(
        n
          ? v_flex().gap(10)
              .child(
                v_flex().gap(8).p(14).rounded(8).border_1().border_color(color).bg(color + "1f")
                  .child(
                    h_flex().gap(10).items_center()
                      .child(div().flex_none().h(20).px(9).flex().items_center().rounded(10).text_size(10).font_semibold().bg(color).text_color(ink(color)).child(NAME[n.status]))
                      .child(div().flex_1().min_w(0).truncate().text_size(16).font_semibold().child(n.title))
                      .child(div().flex_none().text_size(11).text_color(t.muted).child(age(n.since)))
                      .child(
                        div().id("c-goto").flex_none().h(22).px(9).flex().items_center().rounded(11).cursor_pointer().text_size(10).font_semibold()
                          .border_1().border_color(color).text_color(color).hover((x) => x.bg(color).text_color(ink(color)))
                          .tooltip(`Drop into this agent's terminal (${show("go")})`)
                          .on_click(this.on(() => this.act("go"))).child("GO TO AGENT"),
                      ),
                  )
                  .child(div().text_size(11).text_color(t.dim).child(`${parent ? `↳ ${parent.title} · ` : ""}${n.name ? `${n.name} · ` : ""}${n.address} · ${n.spaceName} / ${n.tabName}`))
                  .when(Boolean(n.msg || n.kind) && !form, (el) => el.child(div().text_size(12).text_color(t.foreground).child(n.msg || `waiting: ${n.kind}`))),
              )
              .child(
                form ? this.formView(t, n, form, color) :
                v_flex().max_h(320).overflow_hidden().p(10).rounded(6).bg(t.background).border_1().border_color(t.border).justify_end()
                  .children(tail.length ? tail.map((l) => div().truncate().text_size(11).text_color(t.muted).child(l)) : [div().text_size(11).text_color(t.dim).child("(reading its screen…)")]),
              )
              .when(!form, (el) => el.child(
                h_flex().gap(6).flex_wrap().children(quick.map((r, i) => this.hint(t, String(i + 1), r, () => this.reply(r)))),
              ))
              .child(
                h_flex().gap(8).items_end()
                  .child(div().flex_none().pb(8).text_size(11).text_color(this.otherFor != null ? color : t.dim).child(this.otherFor != null ? "your answer" : "reply"))
                  .child(
                    div().flex_1().min_w(0).child(
                      Textarea.new(this.input).px(10).py(7).rounded(8).border_1()
                        .border_color(this.typing ? t.accent : t.input).bg(t.background).text_size(12).text_color(t.foreground),
                    ),
                  )
                  .child(
                    h_flex().id("c-send").flex_none().h(32).px(13).items_center().rounded(8).cursor_pointer().text_size(12).font_semibold()
                      .border_1().border_color(this.text.trim() ? color : t.input).bg(this.text.trim() ? color : t.raised).text_color(this.text.trim() ? ink(color) : t.dim)
                      .on_click(this.on(() => this.reply(this.text))).child("Send"),
                  ),
              )
          : v_flex().items_center().justify_center().gap(6).py(60)
              .child(div().text_size(18).font_semibold().child("Inbox zero"))
              .child(div().text_size(12).text_color(t.dim).child("Nothing critical is unread. It comes back here if a state changes."))
              .when(nFin > 0, (el) => el.child(div().pt(8).text_size(12).text_color(colorOf(t, "done")).child(`${nFin} finished: press ${show("review")} to look`))),
      )
      )
      .child(
        h_flex().gap(14).flex_wrap().pt(4)
          .child(this.hint(t, show("read"), "mark read", () => this.act("read")))
          .child(this.hint(t, show("leave"), "leave unread", () => this.act("leave")))
          .child(this.hint(t, show("reply"), "reply", () => this.act("reply")))
          .child(this.hint(t, show("go"), "go to agent", () => this.act("go")))
          .child(this.hint(t, show("nudge"), "nudge primary", () => this.act("nudge")))
          .child(this.hint(t, show("review"), nFin ? `finished (${nFin})` : "finished", () => this.act("review")))
          .child(this.hint(t, show("raw"), "raw screen", () => this.act("raw"))),
      );
  }
}
