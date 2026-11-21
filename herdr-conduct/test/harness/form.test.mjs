import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseForm, codexApprovalKey } from "../../mods/conduct-triage/form.js";

import { lookupHarness } from "../../mods/conduct-triage/harnesses.js";

const screen = [
  "──────────────────────────────────────────────────────────────────────────────",
  " ☐ Fruit", "Which fruit?", "❯ 1. Apple", "     Crisp.", "  2. Pear", "     Soft.", "  3. Type something.",
  "──────────────────────────────────────────────────────────────────────────────",
  "  4. Chat about this", "Enter to select · ↑/↓ to navigate · Esc to cancel",
].join("\n");

assert.equal(parseForm(screen, "claude-code").options.length, 3);
assert.equal(parseForm(screen).options.length, 3);          // no app: the Claude Code parser
assert.equal(parseForm(screen, "codex"), null);              // a Claude screen is not a Codex approval
assert.equal(parseForm(screen, "unregistered"), null);
const claude = lookupHarness("claude-code").prompt;
const claudeAgent = { status: "blocked", kind: "question" };
assert.deepEqual(claude.supports, { approval: false, questions: true });
const shown = claude.classify(screen, claudeAgent);
assert.equal(shown.kind, "form");
assert.deepEqual(claude.choiceKeys(screen, shown.form, 2), ["2"]);
assert.equal(claude.choiceKeys(screen.replace("Pear", "Orange"), shown.form, 2), null);
assert.equal(claude.classify(screen + "\n❯ ", claudeAgent).kind, "text");
assert.equal(claude.classify("❯ ", { status: "blocked", kind: "permission" }).kind, "unknown");

const multi = [
  "────────────────────", "←  ☐ Toppings  ✔ Submit  →", "Which toppings?",
  "❯ 1. [ ] Cheese", "  2. [ ] Type something.", "  Submit", "Enter to select · Esc to cancel",
].join("\n");
const multiForm = claude.classify(multi, claudeAgent).form;
assert.equal(multiForm.multi, true);
assert.deepEqual(claude.choiceKeys(multi, multiForm, 2), ["down"]);
assert.deepEqual(claude.actionKeys(multiForm, "advance"), ["right"]);
assert.deepEqual(claude.actionKeys(multiForm, "reset", [1, 2]), ["1", "2"]);
assert.deepEqual(claude.actionKeys({ ...multiForm, inserting: true }, "advance"), ["up", "right"]);

const preview = [
  "────────────────────", " ☐ Color", "Pick a color?",
  "❯ 1. Red     ┌─────┐", "  2. Blue    │ Red │", "             └─────┘",
  "Enter to select · Esc to cancel",
].join("\n");
const previewForm = claude.classify(preview, claudeAgent).form;
assert.equal(previewForm.preview, "Red");
assert.deepEqual(claude.choiceKeys(preview, previewForm, 2), ["2"]);
assert.deepEqual(claude.actionKeys(previewForm, "submitPreview"), ["enter"]);
const review = [
  "────────────────────", "Review your answers", "● Pick a color?", "→ Red",
  "❯ 1. Submit answers", "  2. Cancel",
].join("\n");
const reviewForm = claude.classify(review, claudeAgent).form;
assert.equal(reviewForm.step, "review");
assert.deepEqual(claude.choiceKeys(review, reviewForm, 1), ["1"]);
assert.equal(claude.choiceKeys(review.replace("→ Red", "→ Blue"), reviewForm, 1), null);

const approval = readFileSync(new URL("./codex/command-approval.txt", import.meta.url), "utf8");
const codex = lookupHarness("codex").prompt;
assert.deepEqual(codex.supports, { approval: true, questions: false });
assert.equal(codex.classify(approval, { status: "blocked", kind: "question" }).kind, "unknown");
assert.equal(codex.classify(approval, { status: "working", kind: "permission" }).kind, "unknown");
const classified = codex.classify(approval, { status: "blocked", kind: "permission" });
assert.equal(classified.kind, "form");
const form = parseForm(approval, "codex");
assert.deepEqual(classified.form, form);
assert.deepEqual(codex.choiceKeys(approval, form, 1), ["1"]);
assert.equal(form.approval, true);
assert.match(form.question, /\$ pwd/);
assert.equal(form.cursor, 1);
assert.deepEqual(form.options.map((o) => o.n), [1, 2, 3]);
assert.equal(codexApprovalKey(approval, form, 1), "1");
assert.equal(codexApprovalKey(approval, form, 3), "3");
assert.equal(codexApprovalKey(approval, form, 4), null);
assert.equal(codexApprovalKey(approval.replace("$ pwd", "$ ls"), form, 1), null);
assert.equal(codexApprovalKey(approval.replace("don't ask again", "always allow"), form, 2), null);
assert.equal(parseForm(approval + "› Ask Codex to do anything", "codex"), null);
assert.equal(parseForm(approval.replace("Press enter to confirm or esc to cancel", ""), "codex"), null);
const wrapped = approval.replace("that start with", "that start\n    with");
assert.equal(codexApprovalKey(wrapped, form, 2), "2");
const withoutPersistent = approval.split("\n").filter((line) => !line.includes("don't ask again"))
  .join("\n").replace("3. No", "2. No");
assert.deepEqual(parseForm(withoutPersistent, "codex").options.map((o) => o.n), [1, 2]);

console.log("form registry tests ok");
