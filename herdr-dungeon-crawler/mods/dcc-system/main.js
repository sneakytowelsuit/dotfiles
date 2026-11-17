// Dungeon Crawler Carl layout: the System AI. Watches the crawlers (agents), their
// characters and the floors, and announces what happens in its own deeply unhelpful voice.

import { View, div, svg, image } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { agents, spaces, theme } from "herdr";
import { FLOORS, floorOf } from "./floors.js";
import { who, sprite } from "./cast.js";

const MAX = 40;

const pick = (arr, n) => arr[n % arr.length];

const LINES = {
  arrive: (c, n) => pick([
    `New crawler detected: ${c}. Please sign the waiver.`,
    `${c} has entered the dungeon. Survival odds have been updated. Downward.`,
  ], n),
  working: (c, n) => pick([
    `${c} has engaged a task. The System is taking bets.`,
    `Combat initiated by ${c}. Viewers are tuning in.`,
  ], n),
  blocked: (c, n) => pick([
    `${c} requires your input. The System finds this adorable.`,
    `Attention, crawler: ${c} is waiting. Loot boxes do not open themselves.`,
  ], n),
  done: (c, n) => pick([
    `Achievement unlocked: ${c} finished something! Reward: a Bronze Loot Box.`,
    `${c} has completed the encounter. Contents of loot box: unclear. Do not shake.`,
  ], n),
  gone: (c) => `${c} has left the dungeon. The System regrets nothing.`,
};

// What the System says when you change something on purpose.
const CHANGE = {
  // An agent's character was swapped: `from` is the old name, `to` the new character.
  character: (from, to, n) => pick([
    `Crawler swap detected: ${from} out, ${to.name} in. ${to.snark}`,
    `Costume change! ${from} has been replaced by ${to.name}. No one asked ${from}. ${to.snark}`,
    `The System notes that ${to.name} is now doing ${from}'s job. ${to.snark}`,
    `You have reassigned this crawler from ${from} to ${to.name}. The System would like it noted that it saw this coming. ${to.snark}`,
  ], n),
  // A space was moved to a different floor.
  deeper: (space, from, to, n) => pick([
    `"${space}" has been moved from Floor ${from} to Floor ${to}. Descending voluntarily. The System is touched, and slightly alarmed.`,
    `Floor ${from} to Floor ${to}? Bold. The System has updated your odds. Downward.`,
    `You have chosen Floor ${to} for "${space}". Nobody asked the floor.`,
    `Skipping ahead to Floor ${to}, are we? The System admires the confidence and has questions about the plan.`,
  ], n),
  shallower: (space, from, to, n) => pick([
    `"${space}" retreats from Floor ${from} to Floor ${to}. The System was not aware that was an option. It is filing the paperwork.`,
    `Ascending to Floor ${to}? The viewers have noted your cowardice. They are very supportive. They are lying.`,
    `Floor ${to} again. Nostalgia is not an achievement. The System checked.`,
    `Back up to Floor ${to}. The System will pretend it did not see that, and will remember it forever.`,
  ], n),
};

function stamp() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default class DccSystem extends View {
  init() {
    this.prev = null; // address -> status, null until the first render
    this.chars = null; // address -> character name
    this.floors = null; // space id -> floor number
    this.lastSpace = undefined; // the shown space
    this.log = [{ at: stamp(), text: "Welcome to the Dungeon. The System is monitoring your performance.", color: null }];
    this.n = 0;
  }

  say(text, c) {
    this.log.unshift({ at: stamp(), text, color: c?.color ?? null, face: c ? sprite(c) : null });
    if (this.log.length > MAX) this.log.length = MAX;
  }

  watch(list) {
    const now = new Map(list.map((a) => [a.address, a]));
    const chars = new Map(list.map((a) => [a.address, who(a.address).name]));
    if (this.prev) {
      for (const [addr, a] of now) {
        const c = who(addr);
        const before = this.prev.get(addr);
        if (before === undefined) this.say(LINES.arrive(c.name, this.n++), c);
        else {
          // A character picked by hand (or cleared back to automatic) while the agent stays.
          const was = this.chars?.get(addr);
          if (was && was !== c.name) this.say(CHANGE.character(was, c, this.n++), c);
          if (before !== a.status && LINES[a.status]) this.say(LINES[a.status](c.name, this.n++), c);
        }
      }
      for (const addr of this.prev.keys()) if (!now.has(addr)) this.say(LINES.gone(this.chars?.get(addr) ?? who(addr).name), who(addr));
    }
    this.prev = new Map([...now].map(([k, a]) => [k, a.status]));
    this.chars = chars;
  }

  // Floors: a space moved to another floor, or a different space (on another floor) shown.
  watchFloors(all) {
    const now = new Map(all.map((s) => [s.id, floorOf(s).n]));
    if (this.floors) {
      for (const s of all) {
        const was = this.floors.get(s.id);
        const to = now.get(s.id);
        if (was == null || was === to) continue;
        // The new floor's own welcome first, so the System's comment on the move lands on top of it.
        if (s.active) this.say(FLOORS[to - 1].arrive, null);
        this.say((to > was ? CHANGE.deeper : CHANGE.shallower)(s.name, was, to, this.n++), null);
      }
    }
    const sp = all.find((s) => s.active);
    if (sp) {
      const moved = this.floors?.get(sp.id) !== undefined && this.floors.get(sp.id) !== now.get(sp.id);
      // Showing another space whose floor differs from the last one shown (not a floor change itself).
      if (this.lastSpace !== undefined && this.lastSpace !== sp.id && !moved && this.lastFloorN !== now.get(sp.id)) this.say(floorOf(sp).arrive, null);
      this.lastSpace = sp.id;
      this.lastFloorN = now.get(sp.id);
    }
    this.floors = now;
  }

  render() {
    const t = theme();
    this.watch(agents());
    this.watchFloors(spaces());
    return v_flex()
      .id("dcc-sys")
      .size_full()
      .bg(t.chrome)
      .border_t(1)
      .border_color(t.border)
      .child(
        h_flex().flex_none().px(12).pt(10).pb(6).gap(8).items_center()
          .child(svg("mods/dcc-system/eye.svg").size(15).flex_none().text_color(t.blocked).loop("opacity", { from: 0.5, to: 1, period: 2200 }))
          .child(div().flex_1().text_size(11).font_semibold().text_color(t.accent).child("THE SYSTEM"))
          .child(div().text_size(9).text_color(t.dim).child("AI · ALWAYS WATCHING")),
      )
      .child(
        v_flex().flex_1().min_h(0).overflow_y_scrollbar().px(8).pb(8).gap(6).children(
          this.log.map((m, i) =>
            h_flex()
              .px(8)
              .py(6)
              .gap(8)
              .rounded(3)
              .border_l(2)
              .border_color(m.color ?? t.accent)
              .bg(i === 0 ? t.raised : t.surface)
              .child(m.face ? image(m.face).w(24).h(24).flex_none() : svg("mods/dcc-system/eye.svg").size(20).flex_none().text_color(t.blocked))
              .child(
                v_flex().flex_1().min_w(0).gap(2)
                  .child(div().text_size(9).text_color(t.dim).child(`[${m.at}]`))
                  .child(div().text_size(11).text_color(i === 0 ? t.foreground : t.muted).child(m.text)),
              ),
          ),
        ),
      );
  }
}
