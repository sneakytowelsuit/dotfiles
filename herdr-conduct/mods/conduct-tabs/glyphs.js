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

export function stateIcon(t, status, size) {
  return svg(`mods/conduct-glyphs/${glyphFor(status)}`).size(size).text_color(colorOf(t, status));
}
