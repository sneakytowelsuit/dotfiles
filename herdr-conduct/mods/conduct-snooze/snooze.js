// Snooze and watch: pure logic (no herdr imports; node-tested).
//   shared "conduct.snooze" = { address: { until: ms, mark: "<status>@<since>" } }
//   shared "conduct.watch"  = [address, ...]   ("tell me when it finishes"; the alerts track consumes it)
// The mark is the same "<status>@<since>" string conduct.seen uses, so a snooze ends by itself when the agent
// changes state (the mark stops matching) as well as when `until` passes.

export const MIN = 60000;

/** The mark of a node's current state, as attn.js writes it into conduct.seen. */
export const markOf = (n) => `${n.status}@${n.since ?? ""}`;

/** A new state with this address snoozed. Never mutates. */
export function snoozeFor(state, address, mark, until) {
  return { ...(state ?? {}), [address]: { until, mark } };
}

/** A new state without this address. */
export function unsnooze(state, address) {
  const s = { ...(state ?? {}) };
  delete s[address];
  return s;
}

/** Still snoozed? Only while `until` is ahead AND the agent is still in the state it was snoozed in. */
export function isSnoozed(entry, mark, now) {
  return Boolean(entry) && entry.until > now && entry.mark === mark;
}

const list = (nodes) => (nodes instanceof Map ? [...nodes.values()] : Array.isArray(nodes) ? nodes : Object.values(nodes ?? {}));

/**
 * Entries that just woke: [{ address, reason }]. reason "time" (until passed while the agent is still in that
 * state: it should reappear as UNREAD), "state" (the agent moved on; it is unread by itself if it needs you),
 * "gone" (agent no longer exists: just forget it).
 */
export function due(state, nodes, now) {
  const by = new Map(list(nodes).map((n) => [n.address, n]));
  const out = [];
  for (const [address, e] of Object.entries(state ?? {})) {
    const n = by.get(address);
    if (!n) out.push({ address, reason: "gone" });
    else if (e.mark !== markOf(n)) out.push({ address, reason: "state" });
    else if (e.until <= now) out.push({ address, reason: "time" });
  }
  return out;
}

/** Apply `due`: { state, woken: [address that should be un-marked as seen so they reappear unread] }. */
export function wake(state, nodes, now) {
  const d = due(state, nodes, now);
  let next = state ?? {};
  for (const x of d) next = unsnooze(next, x.address);
  return { state: next, woken: d.filter((x) => x.reason === "time").map((x) => x.address), changed: d.length > 0 };
}

const pad = (n) => String(n).padStart(2, "0");
const hhmm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** The quick choices: [{ id, label, until }]. `now` is ms (local time zone). */
export function presets(now) {
  const d = new Date(now);
  const afternoon = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 14, 0).getTime();
  const tomorrow = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 9, 0).getTime();
  return [
    { id: "5m", label: "5 min", until: now + 5 * MIN },
    { id: "15m", label: "15 min", until: now + 15 * MIN },
    { id: "1h", label: "1 hour", until: now + 60 * MIN },
    now < afternoon
      ? { id: "afternoon", label: "This afternoon (14:00)", until: afternoon }
      : { id: "afternoon", label: "This afternoon (+2 h)", until: now + 120 * MIN },
    { id: "tomorrow", label: "Tomorrow 09:00", until: tomorrow },
  ];
}

/** "14:10" today, "tomorrow 09:00", else "Mon 5 09:00". */
export function untilText(until, now) {
  const d = new Date(until);
  const days = Math.round((startOfDay(d) - startOfDay(new Date(now))) / 86400000);
  if (days <= 0) return hhmm(d);
  if (days === 1) return `tomorrow ${hhmm(d)}`;
  return `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()]} ${d.getDate()} ${hhmm(d)}`;
}

/** Custom minutes text -> ms from now, or null if it isn't a sensible number (1..10080). */
export function minutesToUntil(text, now) {
  const m = Number(String(text ?? "").trim());
  if (!Number.isFinite(m) || m < 1 || m > 7 * 24 * 60) return null;
  return now + Math.round(m) * MIN;
}

/** Add / remove an address in the watch list (new array). */
export function setWatch(list, address, on) {
  const s = new Set(list ?? []);
  on ? s.add(address) : s.delete(address);
  return [...s];
}

/** How many agents are snoozed right now (for a "SNOOZED n" chip). */
export function countSnoozed(state, nodes, now) {
  return list(nodes).filter((n) => isSnoozed(state?.[n.address], markOf(n), now)).length;
}
