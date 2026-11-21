// The registry owns harness-specific activity patterns. Try the reported harness first.
import { HARNESS_REGISTRY, lookupHarness } from "./harnesses.js";

const all = Object.values(HARNESS_REGISTRY).map((h) => h.activity);
const order = (app) => {
  const own = lookupHarness(app)?.activity;
  return own ? [own, ...all.filter((a) => a !== own)] : all;
};

function match(line, app) {
  for (const activity of order(app)) {
    const found = activity.match(line);
    if (found) return { activity, ...found };
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
    return m ? `ACT ${m.verb} ${m.activity.stableStats(m.stats)}`.trim() : l;
  }).join("\n");
}
