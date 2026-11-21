// What a working agent says it is doing, read off its screen: Claude Code shows a line like
// "✻ Thingamajigging… (1m 22s · ↓ 11.8k tokens · thought for 1s)" while it works. Also a signature
// of the screen that ignores the ticking clock, so a hung agent's screen compares equal over time.

const LINE = /^\s*[^\sA-Za-z0-9(]\s+([A-Z][A-Za-z'’-]+)(?:…|\.\.\.)(?:\s*\((.*)\))?\s*$/;

export function parse(text) {
  const lines = String(text).split("\n");
  for (let i = lines.length - 1, seen = 0; i >= 0 && seen < 25; i--) {
    if (!lines[i].trim()) continue;
    seen++;
    const m = LINE.exec(lines[i]);
    if (m) return { verb: m[1], stats: m[2] ? m[2].replace(/\s*·\s*/g, " · ") : "" };
  }
  return null;
}

/** The screen with the activity line reduced to its verb and token count (not its elapsed time). */
export function signature(text) {
  return String(text).split("\n").map((l) => {
    const m = LINE.exec(l);
    if (!m) return l;
    const tokens = (m[2] ?? "").split("·").map((s) => s.trim()).find((s) => /tokens/.test(s)) ?? "";
    return `ACT ${m[1]} ${tokens}`;
  }).join("\n");
}
