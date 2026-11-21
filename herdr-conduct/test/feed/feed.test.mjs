import assert from "node:assert/strict";
import { diffEvents, append, digestSince, groupByDay, unreadCount, makeRecorder, filterFeed } from "../../mods/conduct-feed/feed.js";
import { alertsFor, inQuiet, parseTime, normalize, suggestTopic, validTopic, BATCH_AT } from "../../mods/conduct-feed/alerts.js";

const n = (address, status, extra = {}) => ({ address, title: address, name: null, status, parent: "p1", primary: false, since: null, msg: "", kind: null, focused: false, ...extra });
const M = (...l) => new Map(l.map((x) => [x.address, x]));
const T = 1_700_000_000_000;

// feed
let e = diffEvents(M(n("a", "working")), M(n("a", "blocked", { kind: "question" })), T);
assert.equal(e.length, 1); assert.equal(e[0].to, "blocked"); assert.equal(e[0].text, "a is blocked: waiting: question");
e = diffEvents(M(), M(n("a", "working")), T); assert.deepEqual(e.map((x) => x.to), ["new"]);
e = diffEvents(M(n("a", "idle")), M(), T); assert.equal(e[0].to, "ended");
e = diffEvents(M(n("a", "stalled")), M(n("a", "working")), T); assert.equal(e[0].to, "unstuck");
assert.equal(diffEvents(M(n("a", "working", { since: T - 1000 })), M(n("a", "idle")), T).length, 0, "flicker");
assert.equal(diffEvents(M(n("a", "working", { since: T - 60000 })), M(n("a", "idle")), T).length, 1);
assert.equal(diffEvents(M(n("p", "working", { primary: true })), M(n("p", "idle", { primary: true })), T).length, 0, "primary churn");
assert.equal(diffEvents(M(n("p", "working", { primary: true })), M(n("p", "blocked", { primary: true })), T).length, 1);
assert.equal(diffEvents(M(n("a", "done")), M(n("a", "done")), T).length, 0);

let f = append([], diffEvents(M(n("a", "working")), M(n("a", "done")), T));
f = append(f, diffEvents(M(n("a", "working")), M(n("a", "done")), T + 1000));
assert.equal(f.length, 1, "dedupe");
f = append(f, [{ t: T + 5000, address: "b", title: "b", parent: "p1", to: "blocked", text: "" }]);
assert.equal(f[0].address, "b");
assert.equal(append(Array.from({ length: 10 }, (_, i) => ({ t: i, address: "x" + i, to: "done" })), [], 4).length, 4);
const d = digestSince(f, T - 1); assert.equal(d.total, 2); assert.equal(d.byState.blocked, 1); assert.equal(d.agents.length, 2);
assert.equal(unreadCount(f, T + 1), 1); assert.equal(unreadCount(f, 0), 2);
assert.equal(filterFeed(f, { states: new Set(["done"]) }).length, 1);
const g = groupByDay([{ t: T }, { t: T - 1000 }, { t: T - 3 * 86400000 }], T);
assert.equal(g.length, 2); assert.equal(g[0].label, "Today"); assert.equal(g[0].events.length, 2);

let store = [];
const rec = makeRecorder(() => store, (x) => (store = x));
assert.deepEqual(rec(M(n("a", "working")), T), []);
assert.equal(rec(M(n("a", "blocked")), T + 4000).length, 1); assert.equal(store.length, 1);

// alerts
assert.equal(parseTime("22:30"), 1350); assert.equal(parseTime("25:00"), null); assert.equal(parseTime("8:05"), 485);
const at = (h, m) => new Date(2026, 0, 5, h, m).getTime();
const q = { on: true, from: "22:00", to: "08:00" };
assert.ok(inQuiet(q, at(23, 0))); assert.ok(inQuiet(q, at(3, 0))); assert.ok(!inQuiet(q, at(12, 0))); assert.ok(!inQuiet({ ...q, on: false }, at(23, 0)));
const now = at(12, 0);
let a = alertsFor(M(n("a", "working")), M(n("a", "blocked", { msg: "ok?" })), {}, now);
assert.equal(a.length, 1); assert.equal(a[0].title, "a is blocked"); assert.equal(a[0].body, "ok?"); assert.equal(a[0].push, false);
assert.equal(alertsFor(M(n("a", "working")), M(n("a", "blocked", { focused: true })), {}, now).length, 0, "focused");
assert.equal(alertsFor(M(n("a", "working", { primary: true })), M(n("a", "blocked", { primary: true })), {}, now).length, 0, "primary");
assert.equal(alertsFor(M(n("a", "working")), M(n("a", "blocked")), { enabled: false }, now).length, 0);
assert.equal(alertsFor(M(n("a", "working")), M(n("a", "blocked")), { quiet: q }, at(23, 0)).length, 0);
const st = {};
assert.equal(alertsFor(M(n("a", "working")), M(n("a", "blocked")), {}, now, st).length, 1);
assert.equal(alertsFor(M(n("a", "working")), M(n("a", "blocked")), {}, now + 60000, st).length, 0, "debounce");
assert.equal(alertsFor(M(n("a", "working")), M(n("a", "blocked")), {}, now + 121000, st).length, 1);
const many = Array.from({ length: 5 }, (_, i) => n("w" + i, "blocked"));
a = alertsFor(M(...many.map((x) => n(x.address, "working"))), M(...many), {}, now);
assert.equal(a.length, 1); assert.equal(a[0].title, "5 agents need you"); assert.ok(BATCH_AT <= 5);
a = alertsFor(M(n("a", "working")), M(n("a", "done")), {}, now, { watch: ["a"] });
assert.equal(a.length, 1); assert.deepEqual(a[0].watched, ["a"]); assert.equal(a[0].sound, "done");
assert.equal(alertsFor(M(n("a", "working")), M(n("a", "done")), {}, now, { watch: [] }).length, 0);
a = alertsFor(M(n("a", "working")), M(n("a", "error")), { push: { on: true, topic: "conduct-abcdefgh" } }, now);
assert.equal(a[0].push, true);
assert.ok(validTopic(suggestTopic())); assert.equal(normalize(null).enabled, true);
console.log("feed tests ok");

// Arrivals: a newcomer born blocked is one event, a batch of quiet arrivals collapses.
{
  const mk = (a, status) => ({ address: a, title: a, status, parent: null, since: null });
  const one = diffEvents(new Map(), new Map([["t1", mk("t1", "blocked")]]), 1000);
  assert.equal(one.length, 1); assert.equal(one[0].to, "blocked");
  const many = diffEvents(new Map(), new Map(["a", "b", "c", "d"].map((x) => [x, mk(x, "working")])), 1000);
  assert.equal(many.length, 1); assert.match(many[0].title, /4 agents/);
  const two = diffEvents(new Map(), new Map(["a", "b"].map((x) => [x, mk(x, "idle")])), 1000);
  assert.equal(two.length, 2);
  console.log("arrival tests ok");
}
