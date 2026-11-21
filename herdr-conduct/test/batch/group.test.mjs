import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { groupPrompts, inspectPrompt, normalizeMessage } from "../../mods/conduct-batch/group.js";

test("normalizes variable parts of the same prompt", () => {
  const first = "Approve task-123 for /tmp/a.sh at 2026-11-20T05:09:33Z? (t4v)";
  const next = "Approve task-456 for C:\\work\\b.sh at 2024-02-07T10:25:06-08:00? (t7k)";
  assert.equal(normalizeMessage(first), "approve for at");
  assert.equal(normalizeMessage(next), normalizeMessage(first));
  assert.equal(normalizeMessage("Continue? 12 files at 5:39 PM"), "continue files at");
  assert.equal(normalizeMessage("Retry cd9900f in src/one.js (550e8400-e29b-41d4-a716-446655440000)?"), "retry in");
  assert.notEqual(normalizeMessage(first), normalizeMessage("Reject task-123"));
});

test("groups matching messages and carries a permission flag from any text reply", () => {
  const agents = [
    { address: "t1", msg: "Continue task-32?" },
    { address: "t2", msg: "Continue task-74?" },
    { address: "t3", msg: "Retry the task?" },
  ];
  const groups = groupPrompts(agents.map((agent, i) => ({
    agent,
    prompt: inspectPrompt({ ...agent, app: "claude-code", status: "blocked", kind: "question" },
      i === 1 ? "Waiting for your approval.\n❯ " : "❯ "),
  })));
  assert.deepEqual(groups.map((g) => g.agents.map((a) => a.address)), [["t1", "t2"], ["t3"]]);
  assert.equal(groups[0].message, agents[0].msg);
  assert.equal(groups[0].permission, true);
  assert.equal(groups[1].permission, false);
});

test("reads a fallback question from the tail and excludes Claude forms and blank prompts", () => {
  const agent = { address: "t1", app: "claude-code", status: "blocked", kind: "question" };
  const form = "────────────────────\n☐ Color\nPick a color?\n❯ 1. Red\n  2. Type something.\nEnter to select · Esc to cancel";
  const prompt = inspectPrompt(agent, form + "\n".repeat(35));
  assert.equal(prompt.form, true);
  assert.deepEqual(groupPrompts([{ agent, prompt }]), []);
  assert.deepEqual(groupPrompts([{ agent, prompt: inspectPrompt(agent, "> ") }]), []);
  const screen = `${form}\n${"Output\n".repeat(30)}Should I continue?\n❯ `;
  assert.equal(inspectPrompt(agent, screen).message, "Should I continue?");
});

test("excludes approvals, unsupported menus, and unknown harnesses from batch text replies", () => {
  const approval = readFileSync(new URL("../harness/codex/command-approval.txt", import.meta.url), "utf8");
  const codex = { address: "t2", app: "codex", status: "blocked", kind: "permission", msg: "Continue?" };
  assert.equal(inspectPrompt(codex, approval).kind, "form");
  assert.equal(inspectPrompt(codex, approval.replace("Press enter to confirm or esc to cancel", "")).kind, "unknown");
  assert.equal(inspectPrompt({ ...codex, kind: "question" }, "› 1. Yes\n  2. No").kind, "unknown");
  assert.equal(inspectPrompt({ ...codex, app: "unregistered", kind: "question" }, "❯ ").kind, "unknown");
  assert.equal(inspectPrompt({ ...codex, app: "claude-code" }, "❯ 1. Yes\n  2. No").kind, "unknown");
});
