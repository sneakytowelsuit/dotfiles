import { lookupHarness } from "./harnesses.js";
import { svg } from "gpui-kit";

export const GLYPH = Object.freeze({
  blocked: "blocked.svg",
  error: "error.svg",
  stalled: "stalled.svg",
  done: "done.svg",
  working: "working.svg",
  idle: "idle.svg",
});

export function glyphFor(status) {
  return Object.hasOwn(GLYPH, status) ? GLYPH[status] : GLYPH.idle;
}

function colorOf(t, s) {
  switch (s) {
    case "blocked": return t.blocked;
    case "error": return t.ansi1 ?? t.blocked;
    case "stalled": return t.ansi13 ?? t.ansi5 ?? t.blocked;
    case "done": return t.done;
    case "working": return t.working;
    default: return t.dim;
  }
}

export function stateIcon(t, status, size, spin = true) {
  const el = svg(`mods/conduct-glyphs/${glyphFor(status)}`).size(size).text_color(colorOf(t, status));
  return status === "working" && spin ? el.spin(1800) : el; // the working arc turns
}

/** A plain icon from this folder (map, cost, feed, inbox, nudge, snooze), in a given colour. */
export const icon = (name, size, color) => {
  const el = svg(`mods/conduct-glyphs/${name}.svg`).size(size);
  return color ? el.text_color(color) : el;
};

export const harnessName = (app) => lookupHarness(app)?.identity.name ?? (app || "Agent");
export const harnessIcon = (app, size, color) => {
  const icon = lookupHarness(app)?.identity.icon ?? "harness-generic.svg";
  const el = svg(`mods/conduct-glyphs/${icon}`).size(size);
  return color ? el.text_color(color) : el;
};
