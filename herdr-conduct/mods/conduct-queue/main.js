// Conduct layout: the left sidebar, for supervising many agents from a primary one.
//   NEEDS YOU   every agent that wants you, full rows with reply / nudge buttons
//   a card per primary agent: counts of its sub-agents, a NUDGE button, working ones compact, idle ones folded
//   OTHER AGENTS, then SPACES
// Also the background poller: reads working agents' screens for their activity line and to spot ones
// that have stopped changing ("STUCK?"), and records how long each agent has been in its state.

import { View, div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { spaces, run, theme, hc, shared, setShared, openOverlay, setAgentOrder } from "herdr";
import { ORDER, NAME, SAYS, STALL_MS, needs, sorted, colorOf, ink, go, halo, model, age, markState, markSeen } from "./attn.js";
import { parse, signature } from "./activity.js";

const own = (el) => el.on_mouse_down("left", (_e, cx) => cx.stop_propagation());

const heading = (t, label, n, color) =>
  h_flex().flex_none().px(12).pt(12).pb(5).gap(8).items_center()
    .child(div().text_size(10).font_semibold().text_color(color ?? t.dim).child(label))
    .child(div().text_size(10).text_color(t.dim).child(String(n)))
    .child(div().flex_1().h(1).bg(t.border));

export default class ConductQueue extends View {
  init(_p, cx) {
    this.acts = new Map(); // address -> { verb, stats } from its screen
    this.sigs = new Map(); // address -> { sig, t }: when its screen last changed
    this.open = new Set(); // "<primary>:idle" keys the person unfolded
    const tick = (cx) => cx.spawn(async (cx) => { await this.poll(); cx.notify(); });
    tick(cx);
    cx.timer.every(4000, tick);
    cx.timer.every(15000, (cx) => cx.notify()); // ages tick forward
  }

  async poll() {
    const m = model();
    const now = Date.now();
    // How long each agent has been in its state.
    const since = { ...(shared("conduct.since") ?? {}) };
    let changed = false;
    for (const n of m.list) if (since[n.address]?.status !== n.raw) { since[n.address] = { status: n.raw, t: now }; changed = true; }
    for (const k of Object.keys(since)) if (!m.nodes.has(k)) { delete since[k]; changed = true; }
    if (changed) setShared("conduct.since", since);
    // A "finished" that follows your own answer is the aftermath, not news: mark it read.
    const answered = { ...(shared("conduct.answered") ?? {}) };
    let spent = false;
    for (const n of m.list) {
      const a = answered[n.address];
      if (a == null) continue;
      if (n.raw === "done" && since[n.address] && since[n.address].t >= a) { markState(n.address, "done", since[n.address].t); delete answered[n.address]; spent = true; }
      else if (now - a > 30 * 60 * 1000) { delete answered[n.address]; spent = true; }
    }
    if (spent) setShared("conduct.answered", answered);
    // Working agents: read the screen for the activity line, and for whether it moves.
    const work = m.list.filter((n) => n.raw === "working");
    for (let i = 0; i < work.length; i += 8) {
      await Promise.all(work.slice(i, i + 8).map(async (n) => {
        let r;
        try { r = await hc(["read", n.address]); } catch { return; }
        if (r.code !== 0) return;
        const act = parse(r.stdout);
        act ? this.acts.set(n.address, act) : this.acts.delete(n.address);
        const sig = signature(r.stdout);
        if (this.sigs.get(n.address)?.sig !== sig) this.sigs.set(n.address, { sig, t: now });
      }));
    }
    for (const k of [...this.acts.keys()]) if (!work.some((n) => n.address === k)) { this.acts.delete(k); this.sigs.delete(k); }
    const limit = shared("conduct.stall_ms") ?? STALL_MS;
    const stalled = work.filter((n) => now - (this.sigs.get(n.address)?.t ?? now) > limit).map((n) => n.address).sort();
    if (JSON.stringify(stalled) !== JSON.stringify(shared("conduct.stalled") ?? [])) setShared("conduct.stalled", stalled);
  }

  button(t, id, label, color, onClick) {
    return own(div()).id(id).flex_none().h(20).px(8).flex().items_center().rounded(10).text_size(10).font_semibold()
      .border_1().border_color(color).text_color(color).cursor_pointer()
      .hover((s) => s.bg(color).text_color(ink(color)))
      .on_click((_e, cx) => { cx.stop_propagation(); onClick(); })
      .child(label);
  }

  // Full row: for anything that needs you.
  row(t, a, m) {
    const color = colorOf(t, a.status);
    const act = this.acts.get(a.address);
    const parent = a.parent ? m.nodes.get(a.parent) : null;
    const says = a.status === "blocked" || a.status === "error" ? a.msg || (a.kind ? `waiting: ${a.kind}` : "") : act ? `${act.verb}… ${act.stats}` : a.msg;
    const body = v_flex()
      .id(`c-r-${a.address}`)
      .px(10).py(7).gap(4).rounded(4).cursor_pointer()
      .border_1().border_color(a.focused ? t.accent : color)
      .bg(color + "26")
      .on_click(() => go(a))
      .child(
        h_flex().gap(9).items_center()
          .child(div().flex_none().w(4).h(16).rounded(2).bg(color).loop("opacity", { from: 0.4, to: 1, period: 1000 }))
          .child(div().flex_1().min_w(0).truncate().text_size(12).font_semibold().text_color(t.foreground).child(a.title))
          .when(a.unseen, (el) => el.child(div().flex_none().text_size(9).font_semibold().text_color(color).child("NEW")))
          .child(div().flex_none().text_size(10).text_color(t.muted).child(age(a.since)))
          .child(
            div().flex_none().h(18).px(7).flex().items_center().rounded(9).text_size(9).font_semibold()
              .bg(color).text_color(ink(color)).child(NAME[a.status]),
          ),
      )
      .when(Boolean(says), (el) => el.child(div().truncate().text_size(10).text_color(t.muted).child(says)))
      .child(
        h_flex().gap(6).items_center()
          .child(div().flex_1().min_w(0).truncate().text_size(10).text_color(t.dim).child(`${parent ? `↳ ${parent.title} · ` : ""}${a.spaceName} / ${a.tabName}`))
          .child(
            a.status === "done"
              ? this.button(t, `c-o-${a.address}`, "OPEN", color, () => go(a))
              : this.button(t, `c-s-${a.address}`, a.status === "blocked" ? "REPLY" : "NUDGE", color, () => {
                  if (a.status === "blocked" && a.kind === "question") { setShared("conduct.triage_focus", a.address); run("mod.open", { name: "conduct-triage" }); }
                  else openOverlay({ mod: "conduct-send", kind: "dialog", width: 0.42, props: { mode: "agent", address: a.address } });
                }),
          ),
      )
      .tooltip(`${SAYS[a.status]} · ${a.spaceName} / ${a.tabName}`);
    return halo(color, 4, 4, body);
  }

  // One line: for agents that don't need you.
  line(t, a, indent) {
    const color = colorOf(t, a.status);
    const act = this.acts.get(a.address);
    return h_flex()
      .id(`c-l-${a.address}`)
      .ml(indent ? 22 : 10).mr(8).px(8).py(4).gap(8).items_center().rounded(3).cursor_pointer()
      .hover((x) => x.bg(t.hover))
      .on_click(() => go(a))
      .child(div().flex_none().size(7).rounded_full().border_1().border_color(color).when(a.status === "working", (el) => el.bg(color).loop("opacity", { from: 0.35, to: 1, period: 1200 })))
      .child(div().flex_none().max_w(120).truncate().text_size(11).text_color(t.muted).child(a.title))
      .child(div().flex_1().min_w(0).truncate().text_size(10).text_color(t.dim).child(act ? `${act.verb}… ${act.stats}` : a.msg))
      .child(div().flex_none().text_size(10).text_color(t.dim).child(a.status === "idle" ? "" : age(a.since)));
  }

  // A primary agent and the state of everything it started.
  primary(t, p, m) {
    const kids = [];
    const walk = (n) => n.children.forEach((c) => { const k = m.nodes.get(c); if (k) { kids.push(k); walk(k); } });
    walk(p);
    const count = (s) => kids.filter((k) => k.status === s).length;
    const color = colorOf(t, p.status);
    const idle = sorted(kids.filter((k) => k.status === "idle"));
    const quiet = sorted(kids.filter((k) => k.status === "working"));
    const fin = kids.filter((k) => k.status === "done" && k.fresh);
    const fkey = `${p.address}:fin`;
    const key = `${p.address}:idle`;
    const chips = ORDER.filter((s) => count(s) > 0).map((s) => {
      const c = colorOf(t, s);
      const loud = needs({ status: s });
      return div().flex_none().h(16).px(6).flex().items_center().rounded(8).text_size(9).font_semibold().border_1().border_color(c)
        .when(loud, (el) => el.bg(c).text_color(ink(c)))
        .when(!loud, (el) => el.text_color(c))
        .child(`${count(s)} ${NAME[s]}`);
    });
    return v_flex().mt(10).children([
      h_flex()
        .id(`c-p-${p.address}`)
        .mx(8).px(8).py(6).gap(8).items_center().rounded(4).cursor_pointer().bg(t.surface).border_1().border_color(p.focused ? t.accent : t.border)
        .on_click(() => go(p))
        .child(div().flex_none().text_size(12).text_color(t.accent).child("★"))
        .child(div().flex_1().min_w(0).truncate().text_size(12).font_semibold().text_color(t.foreground).child(p.title))
        .child(div().flex_none().size(7).rounded_full().bg(color))
        .child(
          this.button(t, `c-n-${p.address}`, "NUDGE", t.accent, () =>
            openOverlay({ mod: "conduct-send", kind: "dialog", width: 0.5, props: { mode: "primary", address: p.address } })),
        ),
      h_flex().mx(8).px(8).pt(5).pb(2).gap(4).flex_wrap().children(chips),
      ...quiet.map((k) => this.line(t, k, true)),
      fin.length
        ? own(h_flex()).id(`c-f-${p.address}`).ml(22).mr(8).px(8).py(4).gap(6).items_center().rounded(3).cursor_pointer().hover((x) => x.bg(t.hover))
            .on_click((_e, cx) => { this.open.has(fkey) ? this.open.delete(fkey) : this.open.add(fkey); cx.notify(); })
            .child(div().text_size(10).text_color(t.dim).child(this.open.has(fkey) ? "▾" : "▸"))
            .child(div().text_size(10).text_color(colorOf(t, "done")).child(`${fin.length} finished`))
        : div(),
      ...(this.open.has(fkey) ? fin.map((k) => this.line(t, k, true)) : []),
      idle.length
        ? own(h_flex()).id(`c-i-${p.address}`).ml(22).mr(8).px(8).py(4).gap(6).items_center().rounded(3).cursor_pointer().hover((x) => x.bg(t.hover))
            .on_click((_e, cx) => { this.open.has(key) ? this.open.delete(key) : this.open.add(key); cx.notify(); })
            .child(div().text_size(10).text_color(t.dim).child(this.open.has(key) ? "▾" : "▸"))
            .child(div().text_size(10).text_color(t.dim).child(`${idle.length} idle`))
        : div(),
      ...(this.open.has(key) ? idle.map((k) => this.line(t, k, true)) : []),
    ]);
  }

  space(t, s) {
    const color = s.status ? colorOf(t, s.status) : t.dim;
    const loud = s.status === "blocked";
    return h_flex()
      .id(`c-s-${s.id}`)
      .mx(8).px(8).py(5).gap(9).items_center().rounded(3).cursor_pointer()
      .when(s.active, (el) => el.bg(t.raised))
      .when(!s.active, (el) => el.hover((x) => x.bg(t.hover)))
      .on_click(() => run("space.select", { id: s.id }))
      .child(div().flex_none().size(8).rounded_full().bg(loud ? color : "#00000000").border_1().border_color(color)
        .when(loud, (el) => el.loop("opacity", { from: 0.35, to: 1, period: 1000 })))
      .child(div().flex_1().truncate().text_size(12).text_color(s.active ? t.foreground : t.muted).child(s.name))
      .child(div().flex_none().text_size(10).text_color(t.dim).child(s.branch ? `⎇ ${s.branch}` : ""));
  }

  render() {
    const t = theme();
    const m = model();
    const list = sorted(m.list);
    setAgentOrder(list.map((a) => a.address));
    const wants = list.filter(needs);
    const loners = list.filter((a) => !a.parent && !a.primary && !needs(a));
    const lonerIdle = loners.filter((a) => a.status === "idle");
    const all = spaces();
    return v_flex()
      .id("c-side")
      .size_full()
      .bg(t.chrome)
      .child(
        v_flex().flex_1().min_h(0).overflow_y_scrollbar().pb(8).children(
          list.length
            ? [
                ...(wants.length ? [heading(t, "NEEDS YOU", wants.length, t.blocked), ...wants.map((a) => this.row(t, a, m))] : [h_flex().px(12).pt(12).child(div().text_size(11).text_color(t.dim).child("Nothing needs you."))]),
                ...(m.primaries.length ? [heading(t, "PRIMARY AGENTS", m.primaries.length), ...m.primaries.map((p) => this.primary(t, p, m))] : []),
                ...(loners.length ? [heading(t, "OTHER AGENTS", loners.length), ...loners.filter((a) => a.status !== "idle").map((a) => this.line(t, a, false)),
                    ...(lonerIdle.length ? [div().px(18).py(4).text_size(10).text_color(t.dim).child(`${lonerIdle.length} idle`)] : [])] : []),
              ]
            : [div().px(14).py(14).text_size(11).text_color(t.dim).child("No agents running.")],
        ),
      )
      .child(heading(t, "SPACES", all.length))
      .child(v_flex().flex_none().max_h(180).overflow_y_scrollbar().pb(8).children(all.map((s) => this.space(t, s))));
  }
}
