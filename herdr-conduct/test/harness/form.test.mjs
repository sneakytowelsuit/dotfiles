import assert from "node:assert/strict";
import { parseForm, FORM_PARSERS } from "../../mods/conduct-triage/form.js";

const screen = [
  "──────────────────────────────────────────────────────────────────────────────",
  " ☐ Fruit", "Which fruit?", "❯ 1. Apple", "     Crisp.", "  2. Pear", "     Soft.", "  3. Type something.",
  "──────────────────────────────────────────────────────────────────────────────",
  "  4. Chat about this", "Enter to select · ↑/↓ to navigate · Esc to cancel",
].join("\n");

assert.equal(parseForm(screen, "claude-code").options.length, 3);
assert.equal(parseForm(screen).options.length, 3);          // no app: the Claude Code parser
assert.equal(parseForm(screen, "codex"), null);              // another harness with no parser: raw screen + quick replies
assert.ok(FORM_PARSERS["claude-code"]);
console.log("form registry tests ok");
