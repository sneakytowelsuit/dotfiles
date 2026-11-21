// Canonical harness registry. sync-shared.sh copies these modules to their consumers.
import { claudePrompt, codexPrompt } from "./prompts.js";
import { claudeRecovery, claudeUsage, codexRecovery, codexUsage } from "./session.js";

export const REQUIRED_CAPABILITIES = Object.freeze({
  identity: { strings: ["name", "icon"] },
  status: { flags: ["herdrReports"] },
  activity: { functions: ["match", "stableStats"] },
  prompt: { functions: ["classify", "choiceKeys", "actionKeys"], flags: ["approval", "questions"] },
  usage: { functions: ["read"], flags: ["context", "cacheHits", "cacheExpiry", "cost"] },
  recovery: { functions: ["matches", "resumeArgs"] },
});

const activity = (line, stableStats) => ({
  match(text) {
    const match = line.exec(text);
    return match ? { verb: match[1], stats: match[2] ?? "" } : null;
  },
  stableStats,
});

export const HARNESS_REGISTRY = Object.freeze({
  "claude-code": Object.freeze({
    app: "claude-code",
    identity: { name: "Claude Code", icon: "harness-claude.svg" },
    status: { supports: { herdrReports: true } },
    activity: activity(/^\s*[^\sA-Za-z0-9(•◦]\s+([A-Z][A-Za-z'’-]+)(?:…|\.\.\.)(?:\s*\((.*)\))?\s*$/,
      (stats) => String(stats ?? "").split("·").map((s) => s.trim()).find((s) => /tokens/.test(s)) ?? ""),
    prompt: claudePrompt,
    usage: claudeUsage,
    recovery: claudeRecovery,
  }),
  codex: Object.freeze({
    app: "codex",
    identity: { name: "Codex", icon: "harness-codex.svg" },
    status: { supports: { herdrReports: true } },
    activity: activity(/^\s*[•◦]\s+(Working|Thinking|Reasoning)(?:…|\.\.\.)?\s*\((.*)\)\s*$/, () => ""),
    prompt: codexPrompt,
    usage: codexUsage,
    recovery: codexRecovery,
  }),
});

export const lookupHarness = (app) => Object.hasOwn(HARNESS_REGISTRY, app) ? HARNESS_REGISTRY[app] : null;

/** Report every incomplete path so adding a harness does not become trial and error. */
export function validateHarnesses(registry = HARNESS_REGISTRY) {
  const errors = [];
  for (const [app, adapter] of Object.entries(registry)) {
    if (adapter?.app !== app) errors.push(`${app}.app must match its registry key`);
    for (const [capability, contract] of Object.entries(REQUIRED_CAPABILITIES)) {
      const value = adapter?.[capability];
      if (!value || typeof value !== "object") {
        errors.push(`${app}.${capability} is required`);
        continue;
      }
      const prefix = `${app}.${capability}`;
      for (const name of contract.functions ?? []) {
        if (typeof value[name] !== "function") errors.push(`${prefix}.${name} must be a function`);
      }
      for (const name of contract.strings ?? []) {
        if (typeof value[name] !== "string" || !value[name].trim()) errors.push(`${prefix}.${name} must be a nonempty string`);
      }
      for (const name of contract.flags ?? []) {
        if (typeof value.supports?.[name] !== "boolean") errors.push(`${prefix}.supports.${name} must be declared true or false`);
      }
    }
  }
  return errors;
}
