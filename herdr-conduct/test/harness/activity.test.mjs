import assert from "node:assert/strict";
import { parse, signature, PARSERS } from "../../mods/conduct-queue/activity.js";

// Claude Code
assert.deepEqual(parse("x\n✻ Thingamajigging… (1m 22s · ↓ 11.8k tokens · thought for 1s)\n", "claude-code"), { verb: "Thingamajigging", stats: "1m 22s · ↓ 11.8k tokens · thought for 1s" });
// Codex
assert.deepEqual(parse("• Working (12s • esc to interrupt)\n› Ask Codex\n", "codex"), { verb: "Working", stats: "12s · esc to interrupt" });
// an unknown/missing app still finds either
assert.equal(parse("• Working (3s • esc to interrupt)", undefined).verb, "Working");
assert.equal(parse("✻ Booping…", "whatever").verb, "Booping");
// nothing working
assert.equal(parse("just text\n❯ \n", "codex"), null);
// signature ignores the clock, keeps tokens for Claude
assert.equal(signature("• Working (1s • esc to interrupt)", "codex"), signature("• Working (9s • esc to interrupt)", "codex"));
assert.notEqual(signature("✻ Booping… (1s · ↓ 1k tokens)", "claude-code"), signature("✻ Booping… (2s · ↓ 2k tokens)", "claude-code"));
assert.equal(signature("✻ Booping… (1s · ↓ 1k tokens)", "claude-code"), signature("✻ Booping… (9s · ↓ 1k tokens)", "claude-code"));
assert.ok(PARSERS.length >= 2);
console.log("activity registry tests ok");
