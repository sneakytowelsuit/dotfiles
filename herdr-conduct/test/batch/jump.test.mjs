import assert from "node:assert/strict";
import { test } from "node:test";
import { fuzzyScore, rankEntries } from "../../mods/conduct-jump/search.js";
import { previousAddress, recordRecent } from "../../mods/conduct-jump/recent.js";

test("fuzzy scoring favors exact, prefix, word boundary, then subsequence", () => {
  const scores = ["Worker", "Workers", "Build Worker", "caseworker", "w-o-r-k-e-r", "weaver"]
    .map((field) => fuzzyScore("WORKER", [field]));
  assert.deepEqual(scores, [...scores].sort((a, b) => b - a));
  assert.equal(new Set(scores).size, scores.length);
  assert.equal(scores.at(-1), -Infinity);
  assert.ok(fuzzyScore("cafe t12 tests", ["Café build", "t12", "Waiting for tests"]) > 0);
  assert.equal(fuzzyScore("build deploy", ["Build", "Unit tests"]), -Infinity);
});

test("empty query ranks visits, attention, other agents, then destinations", () => {
  const attention = { address: "a", attention: true, fields: ["Build", "compile error"] };
  const tab = { fields: ["Build tab"] };
  const idle = { address: "b", fields: ["Build worker"] };
  const recent = { address: "c", fields: ["Review"] };
  const last = { address: "d", fields: ["Deploy"] };
  const entries = [tab, idle, attention, last, recent];
  assert.deepEqual(rankEntries("  ", entries, ["c", "missing", "d"]), [recent, last, attention, idle, tab]);
  assert.deepEqual(rankEntries("build error", entries, ["c"]), [attention]);
});

test("recent visits are capped, unique and most recent first", () => {
  const visits = Array.from({ length: 25 }, (_, i) => `t${i}`);
  let recent = visits.reduce(recordRecent, undefined);
  assert.deepEqual(recent, visits.slice(-20).reverse());
  recent = recordRecent(recent, "t20");
  assert.deepEqual(recent.slice(0, 3), ["t20", "t24", "t23"]);
  assert.equal(new Set(recent).size, 20);
  assert.deepEqual(recordRecent("invalid", "t1"), ["t1"]);
});

test("previous skips stale addresses and supports toggling back", () => {
  const live = new Set(["t1", "t2"]);
  let recent = ["t1", "dead", "t2"];
  assert.equal(previousAddress(recent, live, recent[0]), "t2");
  recent = recordRecent(recent, "t2");
  assert.equal(previousAddress(recent, live, recent[0]), "t1");
  assert.equal(previousAddress(recent, new Set(["t2"]), recent[0]), undefined);
});
