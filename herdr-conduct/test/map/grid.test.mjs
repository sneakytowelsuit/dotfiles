import assert from "node:assert/strict";
import test from "node:test";
import { fitCells, filterGroups, gridRows, groupAgents, moveFocus } from "../../mods/conduct-map/grid.js";

const agent = (address, status, { parent = null, primary = false } = {}) => ({
  address, title: address, status, parent, primary,
});
const addresses = (groups) => groups.map((group) => group.agents.map((a) => a.address));

test("groups descendants with their primary and brings critical groups to the front", () => {
  const groups = groupAgents([
    agent("quiet", "idle", { primary: true }),
    agent("stopped", "stalled", { parent: "worker" }),
    agent("loose", "error"),
    agent("worker", "working", { parent: "urgent" }),
    agent("urgent", "working", { primary: true }),
    agent("orphan", "done", { parent: "missing" }),
    agent("cycle-a", "idle", { parent: "cycle-b" }),
    agent("cycle-b", "working", { parent: "cycle-a" }),
  ]);
  assert.deepEqual(addresses(groups), [
    ["urgent", "stopped", "worker"], ["loose", "orphan", "cycle-a", "cycle-b"], ["quiet"],
  ]);
  assert.deepEqual(groups.map((group) => group.critical), [true, true, false]);
  assert.equal(groups[1].primary, null);
  assert.deepEqual(groupAgents([]), []);
});

test("filters effective states, retains primary labels, and drops empty groups", () => {
  const groups = groupAgents([
    agent("p", "idle", { primary: true }),
    { ...agent("child", "stalled", { parent: "p" }), raw: "working" },
    agent("standalone", "working"),
  ]);
  assert.equal(filterGroups(groups, null), groups);
  const stalled = filterGroups(groups, "stalled");
  assert.deepEqual(addresses(stalled), [["child"]]);
  assert.equal(stalled[0].primary.address, "p");
  assert.deepEqual(addresses(filterGroups(groups, "working")), [["standalone"]]);
  assert.deepEqual(filterGroups(groups, "error"), []);
  assert.deepEqual(addresses(groups), [["p", "child"], ["standalone"]]);
});

test("uses compact cells for larger fleets", () => {
});

test("keyboard movement crosses group headers and clamps to shorter rows", () => {
  const rows = gridRows(groupAgents([
    agent("p", "idle", { primary: true }),
    agent("a", "working", { parent: "p" }),
    agent("b", "working", { parent: "p" }),
    agent("x", "done"),
    agent("y", "idle"),
  ]), 2);
  assert.deepEqual(rows.map((row) => row.title ?? row.agents.map((a) => a.address)), [
    "p", ["p", "a"], ["b"], "Other agents", ["x", "y"],
  ]);
  for (const [from, direction, to] of [
    [null, "right", "p"], ["p", "left", "p"], ["p", "right", "a"],
    ["a", "right", "b"], ["a", "down", "b"], ["b", "up", "p"],
    ["x", "left", "b"], ["b", "down", "x"], ["y", "right", "y"],
  ]) assert.equal(moveFocus(rows, from, direction).address, to);
  assert.equal(moveFocus([], null, "left"), undefined);
});

{
  // few agents scale up to fill the space; many shrink to fit; too many scroll at the minimum size
  const few = fitCells([3], 800, 500);
  assert.ok(few.size >= 90, "few agents get big cells");
  const some = fitCells([6, 6], 800, 400);
  assert.ok(some.size > 56 && some.size <= 120);
  const rowsNeeded = (groups, c) => groups.reduce((a, n) => a + Math.ceil(n / c), 0);
  const many = fitCells([40, 40, 20], 800, 400);
  assert.ok(many.size < 56 && many.size >= 22);
  assert.ok(rowsNeeded([40, 40, 20], many.columns) * (many.size + 4) + 3 * 22 <= 400, "it fits the height");
  const tight = fitCells([300], 200, 100); assert.ok(tight.size >= 22 && tight.size < 30); // cannot fit: smallest size, scrolls
  assert.equal(fitCells([], 800, 400).columns, 1);
  console.log("fitCells tests ok");
}
