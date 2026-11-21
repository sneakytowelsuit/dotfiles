// What a working agent says it is doing, read off its screen, per harness.
//   Claude Code:  "✻ Thingamajigging… (1m 22s · ↓ 11.8k tokens · thought for 1s)"
//   Codex:        "• Working (12s • esc to interrupt)"
// To support another harness, add ONE entry to PARSERS (see HARNESSES.md at the layout's root):
//   app    the `status.app` Herdr reports for it (hc ls --json)
//   line   a RegExp for its "I am working" line; group 1 = the verb, group 2 = the stats text (may be absent)
//   tokens (stats) => the part of the stats that only changes when work happens (token counts), "" if none.
// The signature (used to notice a screen that has stopped changing) drops everything that ticks with the clock.

export const PARSERS = [
  {
    app: "claude-code",
    line: /^\s*[^\sA-Za-z0-9(•◦]\s+([A-Z][A-Za-z'’-]+)(?:…|\.\.\.)(?:\s*\((.*)\))?\s*$/,
    tokens: (stats) => String(stats ?? "").split("·").map((s) => s.trim()).find((s) => /tokens/.test(s)) ?? "",
  },
  {
    app: "codex",
    line: /^\s*[•◦]\s+(Working|Thinking|Reasoning)(?:…|\.\.\.)?\s*\((.*)\)\s*$/,
    tokens: () => "",
  },
];

// Parsers to try for an agent: its own harness first, then the rest (the app name may be missing or new).
const order = (app) => [...PARSERS.filter((p) => p.app === app), ...PARSERS.filter((p) => p.app !== app)];

function match(line, app) {
  for (const p of order(app)) {
    const m = p.line.exec(line);
    if (m) return { p, verb: m[1], stats: m[2] ?? "" };
  }
  return null;
}

export function parse(text, app) {
  const lines = String(text).split("\n");
  // The live line sits near the bottom, above the input box; scan up from the end.
  for (let i = lines.length - 1, seen = 0; i >= 0 && seen < 25; i--) {
    if (!lines[i].trim()) continue;
    seen++;
    const m = match(lines[i], app);
    if (m) return { verb: m.verb, stats: m.stats ? m.stats.replace(/\s*[·•]\s*/g, " · ") : "" };
  }
  return null;
}

/** The screen with each activity line reduced to its verb and token count (not its elapsed time). */
export function signature(text, app) {
  return String(text).split("\n").map((l) => {
    const m = match(l, app);
    return m ? `ACT ${m.verb} ${m.p.tokens(m.stats)}`.trim() : l;
  }).join("\n");
}
