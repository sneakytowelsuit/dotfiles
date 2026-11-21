import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { HARNESS_REGISTRY, lookupHarness, validateHarnesses } from "../../mods/conduct-harnesses/harnesses.js";

const appIds = Object.keys(HARNESS_REGISTRY).sort();

test("every shipped harness has a complete capability contract and icon", () => {
  assert.ok(appIds.includes("claude-code") && appIds.includes("codex"));
  assert.deepEqual(validateHarnesses(), []);
  for (const app of appIds) {
    const entry = lookupHarness(app);
    assert.equal(entry, HARNESS_REGISTRY[app]);
    assert.ok(existsSync(new URL(`../../mods/conduct-glyphs/${entry.identity.icon}`, import.meta.url)), app);
  }
  assert.equal(lookupHarness("unknown"), null);
  assert.equal(lookupHarness("constructor"), null);
});

test("validation identifies missing capabilities, methods, and support declarations", () => {
  const entry = {
    ...HARNESS_REGISTRY.codex,
    recovery: null,
    usage: { read: true, supports: { context: true, cacheHits: true, cost: false } },
  };
  assert.deepEqual(validateHarnesses({ codex: entry }), [
    "codex.usage.read must be a function",
    "codex.usage.supports.cacheExpiry must be declared true or false",
    "codex.recovery is required",
  ]);
});

const scenarios = {
  "claude-code": {
    activity: "✻ Booping… (12s · ↓ 30 tokens)",
    argv: ["claude"], resume: ["--continue"],
    prompt: {
      capability: "questions", kind: "question",
      screen: "────────────────────\n☐ Color\nPick a color?\n❯ 1. Red\n  2. Type something.\nEnter to select · Esc to cancel",
    },
  },
  codex: {
    activity: "• Working (12s • esc to interrupt)",
    argv: ["codex", "--no-daemon"], resume: ["resume", "--last"],
    prompt: {
      capability: "approval", kind: "permission",
      screen: readFileSync(new URL("./codex/command-approval.txt", import.meta.url), "utf8"),
    },
  },
};

test("registered adapters have activity, prompt, and recovery examples", () => {
  assert.deepEqual(Object.keys(scenarios).sort(), appIds);
  for (const app of appIds) {
    const h = lookupHarness(app);
    const example = scenarios[app];
    assert.ok(h.activity.match(example.activity)?.verb, app);
    assert.ok(h.recovery.matches(example.argv), app);
    assert.deepEqual(h.recovery.resumeArgs(example.argv), example.resume, app);
    const p = example.prompt;
    assert.equal(h.prompt.supports[p.capability], true, app);
    const result = h.prompt.classify(p.screen, { app, status: "blocked", kind: p.kind });
    assert.equal(result.kind, "form", app);
    assert.deepEqual(h.prompt.choiceKeys(p.screen, result.form, 1), ["1"], app);
  }
});

test("registered usage readers use the correct local session inputs", async () => {
  const claude = lookupHarness("claude-code").usage;
  const claudeCalls = [];
  assert.equal(await claude.read({
    node: { address: "t1" }, state: { file: "", offset: 0 }, now: 20,
    cwdOf: () => "/home/agent/project",
    exec: async (cmd, args) => {
      claudeCalls.push([cmd, ...args.slice(2)]);
      return { code: 0, stdout: "" };
    },
  }), null);
  assert.deepEqual(claudeCalls, [["sh", "sh", "-home-agent-project", "", "0"]]);

  const codex = lookupHarness("codex").usage;
  const codexCalls = [];
  const read = (foreground) => codex.read({
    node: { address: "t2" }, state: {}, now: 20,
    hc: async (args) => {
      assert.deepEqual(args, ["get", "t2", "--json"]);
      return { code: 0, stdout: JSON.stringify({ state: "live", status: { app: "codex" }, foreground }) };
    },
    exec: async (cmd, args) => {
      codexCalls.push([cmd, ...args.slice(2)]);
      return { code: 0, stdout: "usage only" };
    },
    codexMetrics: (lines, now) => ({ lines, now }),
  });
  assert.equal(await read({}), null);
  assert.deepEqual(await read({ pid: 123 }), { lines: ["usage only"], now: 20 });
  assert.deepEqual(codexCalls, [["sh", "sh", "123"]]);
});
