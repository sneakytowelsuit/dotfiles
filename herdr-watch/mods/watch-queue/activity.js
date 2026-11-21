// What a working agent says it is doing, read off its screen: Claude Code shows a line like
// "✻ Thingamajigging… (1m 22s · ↓ 11.8k tokens · thought for 1s)" while it works. Agents that
// print nothing like it return null, and the row falls back to its space and tab.

import { hc } from "herdr";

// A spinner glyph, a capitalised word, an ellipsis, then optional (stats).
const LINE = /^\s*[^\sA-Za-z0-9(]\s+([A-Z][A-Za-z'’-]+)(?:…|\.\.\.)(?:\s*\((.*)\))?\s*$/;

export function parse(text) {
  const lines = String(text).split("\n");
  // The live line sits near the bottom, above the input box; scan up from the end.
  for (let i = lines.length - 1, seen = 0; i >= 0 && seen < 25; i--) {
    if (!lines[i].trim()) continue;
    seen++;
    const m = LINE.exec(lines[i]);
    if (m) return { verb: m[1], stats: m[2] ? m[2].replace(/\s*·\s*/g, " · ") : "" };
  }
  return null;
}

export async function readActivity(address) {
  try {
    const r = await hc(["read", address]);
    return r.code === 0 ? parse(r.stdout) : null;
  } catch {
    return null;
  }
}
