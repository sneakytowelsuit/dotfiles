// Pure: the activity feed ("while you were away"). No herdr imports, so node can test it.
// A feed is an array of events, newest first:
//   { t, address, title, name, parent, parentTitle, from, to, text }
// `to` is a status ("blocked", "error", "stalled", "done", "working", "idle") or "new", "ended", "unstuck".

export const FLICKER_MS = 5000;
export const CAP = 400;
const QUIET = new Set(["working", "idle"]);
/** Events worth a badge: the quiet ones (working, idle, new) are history, not news. */
export const NOTABLE = new Set(["blocked", "error", "stalled", "done", "ended", "unstuck"]);
export const LABEL = { blocked: "blocked", error: "hit an error", stalled: "may be stuck", done: "finished", working: "is working", idle: "is idle", new: "appeared", ended: "ended", unstuck: "is moving again" };
export const CHIP = { blocked: "BLOCKED", error: "ERROR", stalled: "STUCK?", done: "REVIEW", working: "WORKING", idle: "IDLE", new: "NEW", ended: "ENDED", unstuck: "UNSTUCK" };

const nm = (n) => n.title || n.name || n.address;

/** One line: "worker-7 is blocked: waiting: question". */
export function formatText(e) {
  const who = e.title || e.name || e.address;
  switch (e.to) {
    case "new": return `${who} appeared${e.status ? ` (${e.status})` : ""}`;
    case "ended": return `${who} ended`;
    case "unstuck": return `${who} is moving again`;
    case "blocked": return `${who} is blocked${e.detail ? `: ${e.detail}` : ""}`;
    case "error": return `${who} hit an error${e.detail ? `: ${e.detail}` : ""}`;
    case "stalled": return `${who} may be stuck (screen unchanged)`;
    case "done": return `${who} finished${e.detail ? `: ${e.detail}` : ""}`;
    case "working": return `${who} is working again`;
    case "idle": return `${who} is idle`;
    default: return `${who}: ${e.to}`;
  }
}

function ev(t, n, from, to, detail, status) {
  const e = { t, address: n.address, title: nm(n), name: n.name ?? null, parent: n.parent ?? null, from, to, text: "" };
  e.parentTitle = null;
  e.text = formatText({ ...e, detail, status });
  return e;
}

const oneLine = (s) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, 140);
const detailOf = (n) => oneLine(n.msg || (n.kind ? `waiting: ${n.kind}` : ""));

/** Compare two snapshots (Maps or arrays of nodes keyed by address) and return the events between them. */
export function diffEvents(prevNodes, nodes, now) {
  const P = prevNodes instanceof Map ? prevNodes : new Map((prevNodes ?? []).map((n) => [n.address, n]));
  const N = nodes instanceof Map ? nodes : new Map((nodes ?? []).map((n) => [n.address, n]));
  const out = [];
  for (const n of N.values()) {
    const p = P.get(n.address);
    const isPrimary = Boolean(n.primary);
    if (!p) {
      const e = ev(now, n, null, "new", "", n.status);
      out.push(e);
      // Born in a state that needs you: say so too.
      if (n.status === "blocked" || n.status === "error" || n.status === "stalled") out.push(ev(now, n, "new", n.status, detailOf(n)));
      continue;
    }
    if (p.status === n.status) continue;
    if (p.status === "stalled" && n.status !== "stalled") {
      out.push(ev(now, n, p.status, "unstuck", ""));
      if (n.status !== "working") out.push(ev(now, n, "unstuck", n.status, detailOf(n)));
      continue;
    }
    // The primary you talk to finishes after every reply: its done/idle/working churn is not news.
    if (isPrimary && (n.status === "done" || n.status === "idle" || n.status === "working")) continue;
    if (QUIET.has(p.status) && QUIET.has(n.status) && p.since != null && now - p.since < FLICKER_MS) continue;
    out.push(ev(now, n, p.status, n.status, detailOf(n)));
  }
  for (const p of P.values()) if (!N.has(p.address)) out.push(ev(now, p, p.status, "ended", ""));
  // Attach parent titles.
  for (const e of out) if (e.parent) e.parentTitle = (N.get(e.parent) ?? P.get(e.parent))?.title ?? null;
  return out;
}

/** Add events (oldest first within `events`) to the newest-first feed, capped. Skips an immediate repeat. */
export function append(feed, events, cap = CAP) {
  const out = [...(feed ?? [])];
  for (const e of events) {
    const last = out.find((x) => x.address === e.address);
    if (last && last.to === e.to && e.t - last.t < 60000) continue;
    out.unshift(e);
  }
  out.sort((a, b) => b.t - a.t);
  return out.slice(0, cap);
}

/** Events after `ts`: counts per state, and the agents involved. */
export function digestSince(feed, ts) {
  const byState = {};
  const agents = new Map();
  let total = 0;
  for (const e of feed ?? []) {
    if (e.t <= (ts ?? 0)) continue;
    total++;
    byState[e.to] = (byState[e.to] ?? 0) + 1;
    if (!agents.has(e.address)) agents.set(e.address, e.title);
  }
  return { total, byState, agents: [...agents].map(([address, title]) => ({ address, title })) };
}

/** What the bar badge counts: notable events since the person last looked. */
export function unreadCount(feed, seen) {
  let n = 0;
  for (const e of feed ?? []) if (e.t > (seen ?? 0) && NOTABLE.has(e.to)) n++;
  return n;
}

const pad = (n) => String(n).padStart(2, "0");
export const hhmm = (t) => { const d = new Date(t); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const dayKey = (t) => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** [{ key, label, events }] newest day first; labels "Today", "Yesterday", else "Nov 3". */
export function groupByDay(feed, now = Date.now()) {
  const today = dayKey(now), yest = dayKey(now - 86400000);
  const groups = [];
  for (const e of feed ?? []) {
    const k = dayKey(e.t);
    let g = groups[groups.length - 1];
    if (!g || g.key !== k) {
      const d = new Date(e.t);
      g = { key: k, label: k === today ? "Today" : k === yest ? "Yesterday" : `${MONTHS[d.getMonth()]} ${d.getDate()}`, events: [] };
      groups.push(g);
    }
    g.events.push(e);
  }
  return groups;
}

/** Keep events whose state is in `states` (a Set, empty = all) and, if `primary` is set, whose parent is it. */
export function filterFeed(feed, { states, primary } = {}) {
  return (feed ?? []).filter((e) => (!states || states.size === 0 || states.has(e.to)) && (!primary || e.parent === primary || e.address === primary));
}

/** A previous-snapshot recorder with injected storage, so it can be tested: returns record(nodes, now). */
export function makeRecorder(load, save) {
  let prev = null;
  return function record(nodes, now = Date.now()) {
    const snap = new Map([...(nodes instanceof Map ? nodes.values() : nodes)].map((n) => [n.address, { address: n.address, title: n.title, name: n.name, status: n.status, parent: n.parent, primary: n.primary, since: n.since, msg: n.msg, kind: n.kind }]));
    const before = prev;
    prev = snap;
    if (!before) return []; // first look: nothing to compare
    const events = diffEvents(before, snap, now);
    if (events.length) save(append(load(), events));
    return events;
  };
}
