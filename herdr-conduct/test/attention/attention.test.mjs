import assert from "node:assert/strict";
import { test } from "node:test";
import * as S from "../../mods/conduct-snooze/snooze.js";
import * as R from "../../mods/conduct-recover/recover.js";

const at = (y, mo, d, h, mi) => new Date(y, mo - 1, d, h, mi).getTime();
const node = (address, status, since) => ({ address, status, since });

test("snoozeFor / unsnooze are pure", () => {
  const a = {};
  const b = S.snoozeFor(a, "t1", "blocked@5", 100);
  assert.deepEqual(a, {});
  assert.deepEqual(b, { t1: { until: 100, mark: "blocked@5" } });
  assert.deepEqual(S.unsnooze(b, "t1"), {});
  assert.ok(b.t1);
});

test("isSnoozed ends on time or on state change", () => {
  const e = { until: 1000, mark: "blocked@5" };
  assert.equal(S.isSnoozed(e, "blocked@5", 999), true);
  assert.equal(S.isSnoozed(e, "blocked@5", 1000), false);
  assert.equal(S.isSnoozed(e, "error@9", 500), false);
  assert.equal(S.isSnoozed(undefined, "x", 0), false);
});

test("due and wake", () => {
  const st = {
    t1: { until: 100, mark: "blocked@5" },
    t2: { until: 900, mark: "blocked@5" },
    t3: { until: 900, mark: "blocked@5" },
    t4: { until: 900, mark: "blocked@5" },
  };
  const nodes = new Map([["t1", node("t1", "blocked", 5)], ["t2", node("t2", "blocked", 5)], ["t3", node("t3", "done", 8)]]);
  const d = S.due(st, nodes, 500);
  assert.deepEqual(d, [{ address: "t1", reason: "time" }, { address: "t3", reason: "state" }, { address: "t4", reason: "gone" }]);
  const w = S.wake(st, nodes, 500);
  assert.deepEqual(w.woken, ["t1"]);
  assert.deepEqual(Object.keys(w.state), ["t2"]);
  assert.equal(S.wake(w.state, nodes, 500).changed, false);
  assert.equal(S.countSnoozed(st, [...nodes.values()], 500), 1);
});

test("presets before 14:00", () => {
  const now = at(2026, 3, 10, 10, 30);
  const p = S.presets(now);
  assert.deepEqual(p.map((x) => x.id), ["5m", "15m", "1h", "afternoon", "tomorrow"]);
  assert.equal(p[0].until, now + 300000);
  assert.equal(p[2].until, now + 3600000);
  assert.equal(p[3].until, at(2026, 3, 10, 14, 0));
  assert.equal(p[4].until, at(2026, 3, 11, 9, 0));
});

test("presets after 14:00 and across day / month / year boundaries", () => {
  let now = at(2026, 3, 10, 14, 0);
  assert.equal(S.presets(now)[3].until, now + 7200000);
  now = at(2026, 3, 10, 23, 30);
  let p = S.presets(now);
  assert.equal(p[3].until, at(2026, 3, 11, 1, 30));
  assert.equal(p[4].until, at(2026, 3, 11, 9, 0));
  now = at(2026, 12, 31, 20, 0);
  assert.equal(S.presets(now)[4].until, at(2027, 1, 1, 9, 0));
  now = at(2026, 1, 31, 8, 59);
  p = S.presets(now);
  assert.equal(p[3].until, at(2026, 1, 31, 14, 0));
  assert.equal(p[4].until, at(2026, 2, 1, 9, 0));
  now = at(2026, 2, 28, 0, 0); // after midnight: tomorrow is still the next 09:00 day
  assert.equal(S.presets(now)[4].until, at(2026, 3, 1, 9, 0));
});

test("untilText", () => {
  const now = at(2026, 3, 10, 13, 0);
  assert.equal(S.untilText(at(2026, 3, 10, 14, 10), now), "14:10");
  assert.equal(S.untilText(at(2026, 3, 11, 9, 0), now), "tomorrow 09:00");
  assert.equal(S.untilText(at(2026, 3, 11, 1, 5), at(2026, 3, 10, 23, 50)), "tomorrow 01:05");
  assert.match(S.untilText(at(2026, 3, 13, 9, 0), now), /^Fri 13 09:00$/);
});

test("minutesToUntil and setWatch", () => {
  assert.equal(S.minutesToUntil("20", 0), 1200000);
  assert.equal(S.minutesToUntil("0", 0), null);
  assert.equal(S.minutesToUntil("abc", 0), null);
  assert.equal(S.minutesToUntil("", 0), null);
  assert.deepEqual(S.setWatch(["a"], "b", true), ["a", "b"]);
  assert.deepEqual(S.setWatch(["a", "b"], "a", false), ["b"]);
  assert.deepEqual(S.setWatch(["a"], "a", true), ["a"]);
});

test("claude resume detection", () => {
  assert.equal(R.canResume(["/etc/profiles/per-user/a/bin/claude"]), true);
  assert.equal(R.canResume(["claude", "--continue"]), false);
  assert.equal(R.canResume(["claude", "-r", "abc"]), false);
  assert.equal(R.canResume(["codex"]), false);
  assert.deepEqual(R.withContinue(["claude", "do it"]), ["claude", "--continue", "do it"]);
  assert.deepEqual(R.withContinue(["codex"]), ["codex"]);
});

test("restartSpec and runArgs", () => {
  const spec = R.restartSpec({
    argv: ["/bin/zsh"], cwd: "/home/a", name: "worker-1", parent: "t1", keep: true, die_with_parent: false,
    foreground: { argv: ["/bin/claude"], cwd: "/home/a/proj" },
  });
  assert.equal(spec.viaShell, true);
  assert.deepEqual(R.runArgs(spec), ["run", "--bg", "--name", "worker-1", "--cwd", "/home/a/proj", "--parent", "t1", "--outlive-parent", "--keep", "/bin/claude"]);
  assert.deepEqual(R.runArgs(spec, R.withContinue(spec.argv)).slice(-2), ["/bin/claude", "--continue"].slice(0, 2).length ? ["/bin/claude", "--continue"] : []);
  const plain = R.restartSpec({ argv: ["node", "x.js"], cwd: "/w", name: "Bad Name", parent: null });
  assert.equal(plain.name, null);
  assert.deepEqual(R.runArgs(plain), ["run", "--bg", "--cwd", "/w", "--no-parent", "node", "x.js"]);
  assert.equal(R.restartSpec({ argv: [] }), null);
  assert.equal(R.restartSpec(null), null);
});

test("tail", () => {
  assert.equal(R.tail("a\nb\n\n  \n", 5), "a\nb");
  assert.equal(R.tail("1\n2\n3\n4", 2), "3\n4");
});

test("shouldAutoNudge", () => {
  const cfg = { autoNudge: { on: true, minutes: 10 } };
  const n = { address: "t1", status: "stalled", since: 1000 };
  const m10 = 1000 + 10 * 60000;
  assert.equal(R.shouldAutoNudge(n, cfg, m10 - 1, {}), false);
  assert.equal(R.shouldAutoNudge(n, cfg, m10, {}), true);
  assert.equal(R.shouldAutoNudge(n, cfg, m10, { t1: R.stallMark(n) }), false); // once per stall
  assert.equal(R.shouldAutoNudge({ ...n, since: 2000 }, cfg, 2000 + 10 * 60000, { t1: R.stallMark(n) }), true); // a new stall
  assert.equal(R.shouldAutoNudge(n, { autoNudge: { on: false, minutes: 10 } }, m10, {}), false);
  assert.equal(R.shouldAutoNudge(n, undefined, m10, {}), false); // off by default
  for (const s of ["blocked", "error", "working", "done", "idle"]) assert.equal(R.shouldAutoNudge({ ...n, status: s }, cfg, m10 * 9, {}), false);
  assert.equal(R.shouldAutoNudge({ ...n, stuckSince: 5000 }, cfg, 5000 + 599999, {}), false);
  assert.equal(R.shouldAutoNudge({ ...n, since: null }, cfg, m10, {}), false);
  assert.equal(R.shouldAutoNudge(n, { autoNudge: { on: true, minutes: "x" } }, m10, {}), true); // bad minutes -> 10
});

test("recordNudge prunes", () => {
  const nodes = new Map([["t1", { address: "t1", status: "stalled", since: 1 }], ["t2", { address: "t2", status: "done", since: 1 }]]);
  const out = R.recordNudge({ t1: "stalled@1", t2: "stalled@1", t9: "x" }, nodes.get("t1"), nodes);
  assert.deepEqual(out, { t1: "stalled@1" });
});

test("normConfig", () => {
  assert.deepEqual(R.normConfig(undefined), R.DEFAULT_CONFIG);
  assert.equal(R.normConfig({ autoNudge: { on: true, minutes: 3 } }).autoNudge.minutes, 3);
});
