// Pure: when does a state change deserve an interruption? No herdr imports.

export const DEBOUNCE_MS = 2 * 60 * 1000;
export const BATCH_AT = 3; // this many agents in one poll -> one "N agents need you"
const CRIT = new Set(["blocked", "error", "stalled"]);

export const DEFAULTS = Object.freeze({
  enabled: true,
  quiet: { on: false, from: "22:00", to: "08:00" },
  toast: true,
  sound: false, // Herdr plays its own attention sounds (settings.json "sounds"); turn this on if you silenced those
  push: { on: false, topic: "" },
});

/** Merge a stored value over the defaults (ignores junk). */
export function normalize(c) {
  const o = c && typeof c === "object" ? c : {};
  return {
    enabled: o.enabled ?? DEFAULTS.enabled,
    quiet: { ...DEFAULTS.quiet, ...(o.quiet ?? {}) },
    toast: o.toast ?? DEFAULTS.toast,
    sound: o.sound ?? DEFAULTS.sound,
    push: { ...DEFAULTS.push, ...(o.push ?? {}) },
  };
}

/** "22:30" -> minutes after midnight, or null. */
export function parseTime(s) {
  const m = /^\s*([01]?\d|2[0-3]):([0-5]\d)\s*$/.exec(String(s ?? ""));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export const validTopic = (s) => /^[A-Za-z0-9_-]{8,64}$/.test(String(s ?? ""));

/** A hard-to-guess topic suggestion: the topic is the only secret on ntfy.sh. */
export function suggestTopic(rand = Math.random) {
  const abc = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "conduct-";
  const bytes = globalThis.crypto?.getRandomValues ? globalThis.crypto.getRandomValues(new Uint8Array(20)) : null;
  for (let i = 0; i < 20; i++) s += abc[(bytes ? bytes[i] : Math.floor(rand() * 256)) % abc.length];
  return s;
}

/** Is `now` (ms) inside quiet hours? Handles a window across midnight. */
export function inQuiet(quiet, now) {
  if (!quiet?.on) return false;
  const a = parseTime(quiet.from), b = parseTime(quiet.to);
  if (a == null || b == null || a === b) return false;
  const d = new Date(now);
  const m = d.getHours() * 60 + d.getMinutes();
  return a < b ? m >= a && m < b : m >= a || m < b;
}

const asMap = (x) => (x instanceof Map ? x : new Map((x ?? []).map((n) => [n.address, n])));
const line = (n) => String(n.msg || (n.kind ? `waiting: ${n.kind}` : "")).replace(/\s+/g, " ").trim().slice(0, 120);
const VERB = { blocked: "is blocked", error: "hit an error", stalled: "may be stuck" };

/**
 * Alerts to fire for the change prev -> nodes.
 * `state` (optional, mutated): { last: { address: ms of the last alert }, watch: [addresses] }.
 * Each alert: { kind: "need"|"watch", title, body, addresses, sound: "blocked"|"done" (which sound), playSound, toast, push (channel switches), watched: [addresses] }
 */
export function alertsFor(prevNodes, nodes, config, now, state = {}) {
  const c = normalize(config);
  if (!c.enabled) return [];
  if (inQuiet(c.quiet, now)) return [];
  const P = asMap(prevNodes), N = asMap(nodes);
  if (P.size === 0) return []; // first look: everything would look new
  state.last ??= {};
  const watch = new Set(state.watch ?? []);
  const need = [], watched = [];
  for (const n of N.values()) {
    const p = P.get(n.address);
    if (n.primary) continue;
    if (CRIT.has(n.status) && (!p || p.status !== n.status)) {
      if (n.focused) continue;
      if (now - (state.last[n.address] ?? -Infinity) < DEBOUNCE_MS) continue;
      need.push(n);
    } else if (n.status === "done" && p && p.status !== "done" && watch.has(n.address)) watched.push(n);
  }
  const out = [];
  const chan = { toast: c.toast, push: c.push.on && validTopic(c.push.topic), playSound: c.sound };
  if (need.length >= BATCH_AT) {
    out.push({ kind: "need", title: `${need.length} agents need you`, body: need.slice(0, 3).map((n) => n.title).join(", ") + (need.length > 3 ? ", …" : ""), addresses: need.map((n) => n.address), sound: "blocked", watched: [], ...chan });
  } else {
    for (const n of need) out.push({ kind: "need", title: `${n.title} ${VERB[n.status]}`, body: line(n), addresses: [n.address], sound: "blocked", watched: [], ...chan });
  }
  for (const n of need) state.last[n.address] = now;
  for (const n of watched) out.push({ kind: "watch", title: `${n.title} finished`, body: line(n), addresses: [n.address], sound: "done", watched: [n.address], ...chan });
  return out;
}

/** Remove watched addresses that have been announced. */
export const unwatch = (watch, addrs) => (watch ?? []).filter((a) => !addrs.includes(a));
export const toggleWatch = (watch, a) => ((watch ?? []).includes(a) ? unwatch(watch, [a]) : [...(watch ?? []), a]);
