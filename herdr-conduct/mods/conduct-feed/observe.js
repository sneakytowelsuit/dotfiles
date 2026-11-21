// Herdr-dependent glue called by the 4-second poller in conduct-queue: record the feed, decide alerts, fire them.
// Canonical copy in conduct-feed/ (copied by sync-shared.sh). Shared values:
//   conduct.feed (array, newest first)  conduct.feed.seen (ms)  conduct.alerts (config)  conduct.watch (addresses)

import { shared, setShared, notify, playSound, exec } from "herdr";
import { makeRecorder } from "./feed.js";
import { alertsFor, normalize, validTopic, unwatch } from "./alerts.js";

export const loadFeed = () => (Array.isArray(shared("conduct.feed")) ? shared("conduct.feed") : []);
const record = makeRecorder(loadFeed, (f) => setShared("conduct.feed", f));

let prev = null;
const state = { last: {} };

const snapshot = (nodes) => new Map([...(nodes instanceof Map ? nodes.values() : nodes)].map((n) => [n.address, n]));

/** Push through ntfy.sh with a JSON publish (safe for any characters). Resolves true on success. */
export async function push(topic, title, message) {
  if (!validTopic(topic)) return false;
  try {
    const r = await exec("curl", ["-sS", "-m", "5", "--fail", "-d", JSON.stringify({ topic, title, message, tags: ["bell"] }), "https://ntfy.sh"], { timeout: 8000 });
    return r.code === 0;
  } catch { return false; }
}

/** Carry out alerts. Never throws. */
export function fire(alerts, config) {
  const c = normalize(config);
  for (const a of alerts) {
    try {
      if (a.toast) notify({ title: a.title, body: a.body || undefined, level: a.kind === "need" ? "warning" : "success", timeout: 8000, action: { name: "mod.open", args: { name: "conduct-triage" } } });
      if (a.playSound) playSound(a.sound);
      if (a.push && c.push.on) push(c.push.topic, a.title, a.body || a.title);
    } catch {}
  }
}

/** Call once per poll with the model's nodes (the same Map or list the poller already built). */
export function observe(nodes, now = Date.now()) {
  const cur = snapshot(nodes);
  try { record(cur, now); } catch {}
  try {
    const watch = shared("conduct.watch") ?? [];
    state.watch = Array.isArray(watch) ? watch : [];
    const alerts = alertsFor(prev, cur, shared("conduct.alerts"), now, state);
    if (alerts.length) {
      fire(alerts, shared("conduct.alerts"));
      const done = alerts.flatMap((a) => a.watched);
      if (done.length) setShared("conduct.watch", unwatch(state.watch, done));
    }
  } catch {}
  prev = cur;
}
