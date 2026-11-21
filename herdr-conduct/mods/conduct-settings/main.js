// Conduct layout: settings. Two tabs.
//   Hotkeys  every hotkey the layout uses, editable as text ("alt-n, ctrl-shift-n"), with a Record button, conflict
//            checks, per-key Reset and presets that move all the global keys to another modifier (for window
//            managers like Aerospace that already own alt-...). Global keys are written into Herdr's keys.json
//            (section "layout:conduct"); the inbox's own keys are kept in the shared value "conduct.keys".
//   Themes   popular colour themes (Catppuccin, Nord, Gruvbox, Rosé Pine, Dracula, Tokyo Night, Solarized, ...).
//            Their files are written into ~/.config/herdr-app/themes/ on demand, so copying the mods is enough.

import { View, div } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import {
  props, closeOverlay, run, notify, theme, themes as herdrThemes, settings, shared, setShared,
  readTextFile, writeTextFile, appHome, keys as herdrKeys,
} from "herdr";
import { ACTIONS, byId, bindings, checkBinding, pretty } from "./keys.js";
import { THEMES } from "./themes.js";
import { density } from "./density.js";

const MODS_ONLY = /^(ctrl|alt|shift|cmd|control|meta|super)$/i;

// --- keys.json (Herdr reads it live) ---
async function readKeysJson() {
  const path = `${appHome()}/keys.json`;
  const text = await readTextFile(path);
  let json = {};
  try { json = text ? JSON.parse(text) : {}; } catch { throw new Error("keys.json isn't valid JSON, so it was left alone"); }
  return { path, text, json };
}

async function setGlobalKeys(command, list) {
  const { path, text, json } = await readKeysJson();
  const sec = (json["layout:conduct"] ??= {});
  for (const [k, v] of Object.entries(sec)) if (v === command) delete sec[k];
  for (const k of list) sec[k] = command;
  await writeTextFile(path, JSON.stringify(json, null, 2) + "\n", text);
}

const PRESETS = [
  { name: "Default", mod: "alt-" },
  { name: "ctrl-alt", mod: "ctrl-alt-" },
  { name: "ctrl-shift", mod: "ctrl-shift-" },
  { name: "cmd-shift", mod: "cmd-shift-" },
];

export default class ConductSettings extends View {
  init(_p, cx) {
    this.cx = cx;
    this.tab = props()?.tab ?? "keys";
    this.status = new Map(); // action id -> { ok, text }
    this.inputs = new Map();
    this.recording = null;
    this.busy = "";
    this.handle = cx.focus_handle();
    for (const a of ACTIONS) this.makeInput(a.id, bindings(a.id).join(", "), cx);
    cx.timer.after(150, () => this.handle.focus());
    // Global bindings load from keys.json a moment after start: refresh the boxes that aren't being edited.
    cx.timer.after(700, (cx) => { for (const a of ACTIONS) if (a.scope === "global" && !this.status.has(a.id)) this.inputs.get(a.id)?.set_value(bindings(a.id).join(", ")); cx.notify(); });
  }

  makeInput(id, value, cx) {
    const st = InputState.new({ value });
    st.on("submit", () => this.apply(id));
    st.on("focus", (_e, cx) => { this.recording = null; cx.notify(); });
    this.inputs.set(id, st);
  }

  say(id, ok, text) { this.status.set(id, { ok, text }); this.cx.notify(); }

  // Save what's typed in a row.
  async apply(id) {
    const a = byId(id);
    const list = (this.inputs.get(id)?.value() ?? "").split(",").map((x) => x.trim()).filter(Boolean);
    return this.save(a, list);
  }

  async save(a, list) {
    for (const b of list) { const e = checkBinding(b, a.scope); if (e) return this.say(a.id, false, e); }
    // Two actions in one scope can't share a key.
    for (const o of ACTIONS) {
      if (o.id === a.id || o.scope !== a.scope) continue;
      const clash = list.find((b) => bindings(o.id).some((x) => x.toLowerCase() === b.toLowerCase()));
      if (clash) return this.say(a.id, false, `"${clash}" is already "${o.label}"`);
    }
    let warn = "";
    if (a.scope === "global") {
      try {
        const other = herdrKeys().find((k) => list.some((b) => b.toLowerCase() === k.keys.toLowerCase()) && !(k.section === "layout:conduct" && k.action === a.command));
        if (other) warn = ` (Herdr also uses ${other.keys} for ${other.action} in "${other.section}"; the more specific section wins)`;
      } catch {}
      try { await setGlobalKeys(a.command, list); } catch (e) { return this.say(a.id, false, String(e.message ?? e)); }
    } else {
      const cur = { ...(shared("conduct.keys") ?? {}) };
      if (JSON.stringify(list) === JSON.stringify(a.def)) delete cur[a.id]; else cur[a.id] = list;
      setShared("conduct.keys", cur);
    }
    this.inputs.get(a.id)?.set_value(list.join(", "));
    this.say(a.id, true, (list.length ? "Saved." : "Unbound.") + warn);
  }

  async reset(id) {
    const a = byId(id);
    await this.save(a, a.def);
    this.inputs.get(id)?.set_value(a.def.join(", "));
  }

  async resetAll() {
    for (const a of ACTIONS) await this.reset(a.id);
    notify({ title: "Hotkeys reset to the defaults", level: "success", timeout: 2500 });
  }

  // Move every global key to another modifier: alt-t -> ctrl-alt-t.
  async preset(p) {
    for (const a of ACTIONS.filter((x) => x.scope === "global")) {
      await this.save(a, a.def.map((d) => p.mod + d.replace(/^alt-/, "")));
    }
    notify({ title: `Global hotkeys now use ${p.name === "Default" ? "alt-" : p.mod}…`, level: "success", timeout: 2500 });
  }

  // Record: the next chord pressed becomes the binding. (Keys Herdr already binds may act instead of being recorded;
  // the text box always works.)
  key(e, cx) {
    if (this.recording) {
      if (e.key === "escape") { this.recording = null; cx.notify(); cx.stop_propagation(); return; }
      if (MODS_ONLY.test(e.key)) return;
      const id = this.recording;
      this.recording = null;
      this.inputs.get(id)?.set_value(e.keystroke);
      this.apply(id);
      cx.stop_propagation();
      return;
    }
    if (e.key === "escape") { closeOverlay(props().overlay); cx.stop_propagation(); }
  }

  // --- themes ---
  async installThemes() {
    let wrote = 0;
    for (const th of THEMES) {
      const path = `${appHome()}/themes/${th.name}.json`;
      const have = await readTextFile(path);
      if (have == null) { await writeTextFile(path, JSON.stringify(th.theme, null, 2) + "\n", null); wrote++; }
    }
    return wrote;
  }

  // Herdr shows the light or the dark half of a layout's theme according to its appearance (the system's unless
  // settings.json says otherwise), so picking a light theme in a dark system would change nothing. Match it.
  async matchAppearance(light) {
    const path = `${appHome()}/settings.json`;
    const text = await readTextFile(path);
    let json = {};
    try { json = text ? JSON.parse(text) : {}; } catch { return; }
    const want = light ? "light" : "dark";
    if (json.appearance === want) return;
    json.appearance = want;
    await writeTextFile(path, JSON.stringify(json, null, 2) + "\n", text);
  }

  async applyTheme(name) {
    this.busy = name;
    this.themeError = "";
    this.cx.notify();
    try {
      const wrote = await this.installThemes();
      await this.matchAppearance(Boolean(THEMES.find((x) => x.name === name)?.light));
      await new Promise((r) => this.cx.timer.after(wrote ? 700 : 150, () => r()));
      run("app.theme", { name });
    } catch (e) {
      this.themeError = String(e.message ?? e);
      notify({ title: "Couldn't apply the theme", body: this.themeError, level: "error", timeout: 4000 });
    }
    this.busy = "";
    this.cx.notify();
  }

  on(fn) { return () => fn(); } // never keep a handler's cx: it is invalid after the first await; this.cx stays init's AsyncContext

  btn(t, id, label, primary, fn) {
    return h_flex().id(id).h(28).px(12).items_center().rounded(8).cursor_pointer().text_size(11).font_semibold()
      .border_1().border_color(primary ? t.accent : t.input).bg(primary ? t.accent : t.raised).text_color(primary ? t.accent_foreground : t.foreground)
      .hover((x) => x.opacity(0.88)).on_click(this.on(fn)).child(label);
  }

  keyRow(t, a) {
    const st = this.status.get(a.id);
    const rec = this.recording === a.id;
    const custom = JSON.stringify(bindings(a.id)) !== JSON.stringify(a.def);
    return v_flex().gap(4).py(8).border_b(1).border_color(t.border)
      .child(
        h_flex().gap(10).items_center()
          .child(v_flex().flex_1().min_w(0).gap(1)
            .child(div().text_size(12).font_semibold().text_color(t.foreground).child(a.label))
            .when(Boolean(a.note), (d) => d.child(div().text_size(10).text_color(t.dim).child(a.note))))
          .child(div().w(190).flex_none().child(
            Input.new(this.inputs.get(a.id)).h(30).px(9).rounded(7).border_1().border_color(rec ? t.accent : t.input).bg(t.background).text_size(12).text_color(t.foreground)))
          .child(this.btn(t, `s-save-${a.id}`, "Save", false, () => this.apply(a.id)))
          .child(this.btn(t, `s-rec-${a.id}`, rec ? "Press a key…" : "Record", rec, () => { this.recording = rec ? null : a.id; this.handle.focus(); this.cx.notify(); }))
          .child(div().w(54).flex_none().child(custom ? this.btn(t, `s-reset-${a.id}`, "Reset", false, () => this.reset(a.id)) : div())),
      )
      .when(Boolean(st), (d) => d.child(div().text_size(10).text_color(st.ok ? t.done : t.blocked).child(st.text)));
  }

  keysTab(t) {
    const group = (scope, title, sub) => [
      v_flex().pt(14).pb(2).gap(2).child(div().text_size(10).font_semibold().text_color(t.dim).child(title)).child(div().text_size(11).text_color(t.muted).child(sub)),
      ...ACTIONS.filter((a) => a.scope === scope).map((a) => this.keyRow(t, a)),
    ];
    return v_flex().gap(0)
      .child(div().text_size(12).text_color(t.muted).child("Write bindings as Herdr does (alt-n, ctrl-shift-n, f5, right), several separated by commas. Press Enter or Save to apply."))
      .child(
        h_flex().gap(8).pt(10).items_center().flex_wrap()
          .child(div().text_size(11).text_color(t.dim).child("Move every global key to:"))
          .children(PRESETS.map((p) => this.btn(t, `s-p-${p.name}`, p.name, false, () => this.preset(p))))
          .child(div().flex_1())
          .child(this.btn(t, "s-resetall", "Reset all", false, () => this.resetAll())),
      )
      .child(h_flex().gap(8).pt(8).items_center()
        .child(div().text_size(11).text_color(t.dim).child("Related:"))
        .child(this.btn(t, "s-open-map", "Agent map", false, () => run("mod.open", { name: "conduct-map" })))
        .child(this.btn(t, "s-open-jump", "Jump palette", false, () => run("mod.open", { name: "conduct-jump" })))
        .child(this.btn(t, "s-open-batch", "Batch reply", false, () => run("mod.open", { name: "conduct-batch" })))
        .child(this.btn(t, "s-open-usage", "Usage", false, () => run("mod.open", { name: "conduct-usage" })))
        .child(this.btn(t, "s-open-feed", "Activity feed", false, () => run("mod.open", { name: "conduct-feed" })))
        .child(this.btn(t, "s-open-alerts", "Alert settings…", false, () => run("mod.open", { name: "conduct-alerts" }))))
      .child(div().pt(8).text_size(11).text_color(t.dim).child("Tiling window managers such as Aerospace or i3 often own alt-…; ctrl-alt-… or ctrl-shift-… usually stay free."))
      .children(group("global", "ANYWHERE IN THE LAYOUT", "Handled by Herdr: saved to keys.json and live at once."))
      .children(group("inbox", "IN THE INBOX", "Plain keys, active while the inbox is open. The number keys always pick form options."));
  }

  themesTab(t) {
    const cur = settings()?.theme;
    const curName = typeof cur === "string" ? cur : cur?.dark ?? cur?.light ?? "";
    let installed = [];
    try { installed = herdrThemes().map((x) => x.name); } catch {}
    const families = [...new Set(THEMES.map((x) => x.family))];
    const card = (th) => {
      const c = th.theme.colors;
      const on = curName === th.name;
      return v_flex().id(`s-th-${th.name}`).w(176).gap(7).p(9).rounded(10).cursor_pointer()
        .border_1().border_color(on ? t.accent : t.border).bg(on ? t.accent + "1a" : t.surface)
        .hover((x) => x.border_color(t.accent))
        .on_click(this.on(() => this.applyTheme(th.name)))
        .child(
          h_flex().gap(4).items_center().p(7).rounded(6).bg(th.theme.background)
            .children([th.theme.foreground, c.accent, c.blocked, c.working, c.done, th.theme.ansi[2]].map((col) => div().flex_none().size(14).rounded_full().bg(col))),
        )
        .child(h_flex().gap(6).items_center()
          .child(div().flex_1().min_w(0).truncate().text_size(12).font_semibold().text_color(t.foreground).child(th.label))
          .when(th.light, (d) => d.child(div().text_size(9).text_color(t.dim).child("light")))
          .when(on, (d) => d.child(div().text_size(9).font_semibold().text_color(t.accent).child("ACTIVE")))
          .when(this.busy === th.name, (d) => d.child(div().text_size(9).text_color(t.dim).child("…"))));
    };
    const others = installed.filter((n) => !THEMES.some((x) => x.name === n) && !n.startsWith("dungeon"));
    return v_flex().gap(14)
      .when(Boolean(this.themeError), (d) => d.child(div().text_size(11).text_color(t.blocked).child(`Couldn't apply the theme: ${this.themeError}`)))
      .child(div().text_size(12).text_color(t.muted).child("Click a theme to apply it. Missing theme files are written to ~/.config/herdr-app/themes/ for you. Light themes also switch Herdr to its light appearance (and dark ones back), so they show whatever the system is set to."))
      .children(families.map((f) => v_flex().gap(8)
        .child(div().text_size(10).font_semibold().text_color(t.dim).child(f.toUpperCase()))
        .child(h_flex().gap(10).flex_wrap().children(THEMES.filter((x) => x.family === f).map(card)))))
      .when(others.length > 0, (d) => d.child(v_flex().gap(8)
        .child(div().text_size(10).font_semibold().text_color(t.dim).child("ALSO INSTALLED"))
        .child(h_flex().gap(8).flex_wrap().children(others.map((n) => this.btn(t, `s-o-${n}`, n, n === curName, () => run("app.theme", { name: n })))))));
  }

  densityTab(t) {
    const current = density();
    return v_flex().gap(10)
      .child(div().text_size(12).text_color(t.muted).child("Spacing of the agent lists in the sidebar. Compact fits more agents on screen."))
      .child(h_flex().gap(8).children([["comfortable", "Comfortable"], ["compact", "Compact"]].map(([mode, label]) => {
        const active = current === mode;
        return h_flex().id(`density-${mode}`).h(30).px(12).items_center().rounded(8).cursor_pointer().text_size(12)
          .border_1().border_color(active ? t.accent : t.border).bg(active ? t.accent : t.raised).text_color(active ? t.accent_foreground : t.foreground)
          .on_click(this.on(() => { setShared("conduct.density", mode); this.cx.notify(); })).child(label);
      })));
  }

  render(cx) {
    const t = theme();
    const tabBtn = (id, label) =>
      h_flex().id(`s-tab-${id}`).h(30).px(14).items_center().rounded(8).cursor_pointer().text_size(12).font_semibold()
        .when(this.tab === id, (d) => d.bg(t.accent).text_color(t.accent_foreground))
        .when(this.tab !== id, (d) => d.text_color(t.muted).hover((x) => x.bg(t.hover)))
        .on_click(this.on(() => { this.tab = id; this.cx.notify(); }))
        .child(label);
    return v_flex().id("c-settings").track_focus(this.handle).on_key_down((e, cx) => this.key(e, cx))
      .w_full().h_full().p(18).gap(12).bg(t.popover).text_color(t.foreground)
      .child(
        h_flex().items_center().gap(10)
          .child(div().text_size(15).font_semibold().child("Conduct settings"))
          .child(div().flex_1())
          .child(tabBtn("keys", "Hotkeys"))
          .child(tabBtn("themes", "Themes"))
          .child(tabBtn("density", "Density"))
          .child(div().text_size(11).text_color(t.dim).ml(8).child("Esc")),
      )
      .child(v_flex().id("s-body").flex_1().min_h(0).overflow_y_scrollbar().pr(6).child(this.tab === "density" ? this.densityTab(t) : this.tab === "keys" ? this.keysTab(t) : this.themesTab(t)));
  }
}
