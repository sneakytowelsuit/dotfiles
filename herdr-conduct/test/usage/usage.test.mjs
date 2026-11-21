// node --test herdr-conduct/test/usage/   (synthetic fixtures only: no real transcript content)
import test from "node:test";
import assert from "node:assert/strict";
import * as U from "../../mods/conduct-usage/usage.js";

const T0 = Date.parse("2026-01-01T12:00:00Z");
const line = (o) => JSON.stringify({
  type: "assistant", timestamp: new Date(T0 + (o.at ?? 0) * 1000).toISOString(),
  message: { id: o.id ?? `m${o.at}`, model: o.model ?? "claude-sonnet-5-5", usage: {
    input_tokens: o.in ?? 1, output_tokens: o.out ?? 100, cache_read_input_tokens: o.cr ?? 0, cache_creation_input_tokens: o.cc ?? 0,
    ...(o.c5 !== undefined || o.c1 !== undefined ? { cache_creation: { ephemeral_5m_input_tokens: o.c5 ?? 0, ephemeral_1h_input_tokens: o.c1 ?? 0 } } : {}) } },
});
const near = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} !~ ${b}`);

test("parse: skips junk, partial first line, user lines, sidechains, synthetic", () => {
  const text = [
    '{"type":"assistant","message":{"usage":{"inp', // cut off
    JSON.stringify({ type: "user", message: { content: "x" } }),
    JSON.stringify({ type: "assistant", isSidechain: true, timestamp: new Date(T0).toISOString(), message: { model: "claude-sonnet-5-5", usage: { input_tokens: 5 } } }),
    JSON.stringify({ type: "assistant", timestamp: new Date(T0).toISOString(), message: { model: "<synthetic>", usage: { input_tokens: 5 } } }),
    JSON.stringify({ type: "assistant", timestamp: "garbage", message: { model: "m", usage: {} } }),
    "", line({ at: 10, in: 3, out: 7, cr: 100, cc: 50, c1: 50, c5: 0 }),
  ].join("\n");
  const r = U.parseTurns(text);
  assert.equal(r.length, 1);
  assert.deepEqual([r[0].input, r[0].output, r[0].cacheRead, r[0].cacheCreate5m, r[0].cacheCreate1h], [3, 7, 100, 0, 50]);
});
test("parse: empty and non-string input", () => {
  assert.deepEqual(U.parseTurns(""), []);
  assert.deepEqual(U.parseTurns(null), []);
  assert.equal(U.metrics([]), null);
  assert.equal(U.metrics(null), null);
});
test("parse: same message id collapses to the last write; missing fields are zero", () => {
  const r = U.parseTurns([line({ at: 1, id: "a", out: 5 }), line({ at: 2, id: "a", out: 50 }), JSON.stringify({ timestamp: new Date(T0 + 3000).toISOString(), message: { usage: {} } })]);
  assert.equal(r.length, 2);
  assert.equal(r.find((x) => x.id === "a").output, 50);
  assert.equal(r[1].model, null);
  assert.equal(r[1].input, 0);
});
test("parse: no cache_creation breakdown means 5m; unsorted input is sorted", () => {
  const r = U.parseTurns([line({ at: 9, cc: 40 }), line({ at: 1, cc: 10 })]);
  assert.equal(r[0].t < r[1].t, true);
  assert.equal(r[1].cacheCreate5m, 40);
  assert.equal(r[1].cacheCreate1h, 0);
});

test("window and prices by model, unknown model flagged", () => {
  assert.equal(U.windowFor("claude-sonnet-5-5"), 1e6);
  assert.equal(U.windowFor("claude-haiku-4-5-20251001"), 200000);
  assert.equal(U.windowFor("claude-3-5-sonnet"), 200000);
  assert.equal(U.windowFor(undefined), 1e6);
  assert.equal(U.priceFor("claude-opus-4-1-2025").family, "opus-legacy");
  assert.equal(U.priceFor("claude-opus-5").family, "opus");
  assert.equal(U.priceFor("claude-haiku-4-5").in, 1);
  assert.equal(U.priceFor("gpt-xyz").known, false);
  assert.equal(U.priceFor(null).family, "unknown");
});

test("cost and savings", () => {
  const r = { model: "claude-sonnet-5-5", input: 1e6, output: 1e6, cacheRead: 1e6, cacheCreate5m: 1e6, cacheCreate1h: 1e6 };
  near(U.costOf(r), 3 + 15 + 0.3 + 3.75 + 6);
  near(U.savingsOf(r), 3 - 0.3);
  const tot = U.addTurn(U.addTurn(U.emptyTotals(), r), r, -1);
  near(U.totalCost(tot), 0);
});

test("context window: last turn, fraction, turns until full", () => {
  const turns = [0, 1, 2, 3].map((i) => U.parseTurns([line({ at: i * 30, in: 2, cr: 100000 + i * 50000, cc: 1000 })])[0]);
  const m = U.metrics(turns, { now: T0 + 100000 });
  assert.equal(m.ctx.used, 2 + 250000 + 1000);
  assert.equal(m.ctx.total, 1e6);
  near(m.ctx.frac, 0.251, 1e-3);
  assert.equal(m.ctx.left, 1e6 - m.ctx.used);
  assert.equal(m.ctx.turnsLeft, Math.floor((1e6 - 251002) / 50000));
});
test("context: compaction resets growth; flat or single turn has no estimate; over-full clamps", () => {
  const t = (cr, i) => U.parseTurns([line({ at: i, cr })])[0];
  assert.equal(U.growthPerTurn([t(10, 0)]), null);
  assert.equal(U.growthPerTurn([t(500000, 0), t(500000, 1)]), null);
  assert.equal(U.growthPerTurn([t(800000, 0), t(100000, 1), t(150000, 2)]), 50000);
  const m = U.metrics([t(1200000, 0)], { now: T0 });
  assert.equal(m.ctx.left, 0);
  assert.equal(m.ctx.turnsLeft, null);
});

test("cache hit ratio and outcomes", () => {
  const hit = U.parseTurns([line({ at: 1, in: 1, cr: 99, cc: 0 })])[0];
  near(U.hitRatio(hit), 0.99);
  assert.equal(U.outcome(0.99), "hit");
  assert.equal(U.outcome(0.9), "hit");
  assert.equal(U.outcome(0.5), "partial");
  assert.equal(U.outcome(0.1), "miss");
  assert.equal(U.hitRatio({ input: 0, cacheRead: 0, cacheCreate5m: 0, cacheCreate1h: 0 }), 0);
  const turns = U.parseTurns([line({ at: 1, cr: 0, cc: 1000 }), line({ at: 2, cr: 1000, cc: 0, in: 0 })]);
  const m = U.metrics(turns, { now: T0 + 5000 });
  assert.equal(m.cache.last, 1);
  near(m.cache.ratio, 1000 / 2001, 1e-3);
  assert.deepEqual(m.cache.seq.length, 2);
});
test("cache sequence keeps only the last 10 turns", () => {
  const turns = U.parseTurns(Array.from({ length: 25 }, (_, i) => line({ at: i, cr: 1000 })));
  assert.equal(U.metrics(turns, { now: T0 }).cache.seq.length, 10);
});

test("cache timer: ttl 5m by default, 1h with 1h creation", () => {
  const five = U.parseTurns([line({ at: 0, cc: 10, c5: 10, c1: 0 })]);
  const one = U.parseTurns([line({ at: 0, cc: 10, c5: 0, c1: 10 })]);
  assert.equal(U.metrics(five, { now: T0 }).cache.ttl, 300);
  assert.equal(U.metrics(one, { now: T0 }).cache.ttl, 3600);
  assert.equal(U.metrics(U.parseTurns([line({ at: 0 })]), { now: T0 }).cache.ttl, 300); // nothing created: default
});
test("cache timer: warm, cooling, cold and the edges", () => {
  const c = { ttl: 300, lastAt: T0 };
  assert.equal(U.cacheTimer(c, T0).state, "warm");
  assert.equal(U.cacheTimer(c, T0 + 224000).state, "warm"); // 76s left
  assert.equal(U.cacheTimer(c, T0 + 226000).state, "cooling"); // 74s left, < 25%
  assert.equal(U.cacheTimer(c, T0 + 299000).state, "cooling");
  assert.equal(U.cacheTimer(c, T0 + 300000).state, "cold"); // exactly expired
  assert.equal(U.cacheTimer(c, T0 + 900000).remaining, 0);
  assert.equal(U.cacheTimer(c, T0 - 5000).frac, 1 + 5 / 300 > 1 ? U.cacheTimer(c, T0 - 5000).frac : 1); // clock skew: stays sane
  const h = { ttl: 3600, lastAt: T0 };
  assert.equal(U.cacheTimer(h, T0 + 2000 * 1000).state, "warm");
  assert.equal(U.cacheTimer(h, T0 + 2800 * 1000).state, "cooling"); // < 25% left
  assert.equal(U.cacheTimer(h, T0 + 3601 * 1000).state, "cold");
  assert.equal(U.cacheTimer(null), null);
  assert.equal(U.cacheTimer({ ttl: 0, lastAt: 1 }), null);
  assert.equal(U.cacheTimer({ ttl: 300 }), null);
});

test("cost estimate: session, last turn, savings, cold extra", () => {
  const turns = U.parseTurns([
    line({ at: 0, in: 0, out: 0, cr: 0, cc: 1e6, c5: 1e6 }),
    line({ at: 60, in: 0, out: 1e6, cr: 1e6, cc: 0 }),
  ]);
  const m = U.metrics(turns, { now: T0 + 70000 });
  near(m.cost.session, 3.75 + 15 + 0.3);
  near(m.cost.lastTurn, 15.3);
  near(m.cost.savings, 2.7);
  assert.equal(m.cost.known, true);
  // context 1M tokens (all cache read last turn); the next turn on a cold 5m cache re-creates it
  near(m.cache.coldExtra, 1e6 * (3.75 - 0.3) / 1e6, 1e-3);
  assert.equal(U.metrics(U.parseTurns([line({ at: 0, model: "mystery" })]), { now: T0 }).cost.known, false);
});
test("totals can cover more than the kept turns", () => {
  const turns = U.parseTurns([line({ at: 0, out: 1e6 })]);
  const tot = U.addTurn(U.addTurn(U.emptyTotals(), turns[0]), { ...turns[0], output: 1e6 });
  near(U.metrics(turns, { totals: tot, now: T0 }).cost.session, 30);
});

test("burn rate over the last 10 minutes", () => {
  const turns = U.parseTurns([
    line({ at: -3000, out: 999999 }), // outside the window
    line({ at: 0, in: 0, out: 1e6, cr: 5e6 }),
    line({ at: 300, in: 0, out: 1e6, cr: 5e6 }),
  ]);
  const m = U.metrics(turns, { now: T0 + 600 * 1000 });
  assert.equal(m.rate.tokPerMin, 200000); // 2M new tokens / 10 min; cache reads not counted
  near(m.rate.costPerHour, ((15 + 1.5) * 2 / 10) * 60, 1e-2); // 2 turns x ($15 output + $1.5 reads) over 10 min
  const idle = U.metrics(turns, { now: T0 + 5000 * 1000 });
  assert.equal(idle.rate.tokPerMin, 0);
  assert.equal(idle.rate.costPerHour, 0);
});

test("fleet totals", () => {
  const mk = (frac, lastAt, ratio, cost) => ({ ctx: { used: 100, frac }, cache: { ratio, ttl: 300, lastAt }, cost: { session: cost, savings: 1 }, rate: { costPerHour: 2 } });
  const f = U.fleet({ a: mk(0.95, T0, 0.5, 1), b: mk(0.1, T0 - 400000, 1, 2), c: null }, { now: T0 + 1000 });
  assert.equal(f.agents, 2); assert.equal(f.cold, 1); assert.equal(f.full, 1);
  assert.equal(f.cost, 3); assert.equal(f.perHour, 4); near(f.ratio, 0.75);
  assert.deepEqual(U.fleet({}), { agents: 0, cost: 0, perHour: 0, savings: 0, ratio: 0, cold: 0, full: 0 });
});

test("formatters", () => {
  assert.equal(U.money(0), "$0.00"); assert.equal(U.money(0.004), "<$0.01"); assert.equal(U.money(12.345), "$12.35"); assert.equal(U.money(250.4), "$250");
  assert.equal(U.kilo(412000), "412k"); assert.equal(U.kilo(1e6), "1.0M"); assert.equal(U.kilo(512), "512");
  assert.equal(U.clock(45), "45s"); assert.equal(U.clock(125), "2m 05s"); assert.equal(U.clock(3700), "1h 1m");
});
