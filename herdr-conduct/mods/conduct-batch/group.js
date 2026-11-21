import { lookupHarness } from "./harnesses.js";

const PERMISSION = /\b(?:permissions?|approve|approval|allow|authoriz[ei]\w*|run this command|do you want to (?:proceed|run|execute|allow|make)|would you like to (?:proceed|run|execute|allow))\b/i;

export function normalizeMessage(message) {
  return message.normalize("NFKC").toLowerCase()
    .replace(/\b\d{4}-\d{2}-\d{2}(?:[t ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:z|[+-]\d{2}:?\d{2})?)?\b/g, "")
    .replace(/\b\d{1,2}:\d{2}(?::\d{2})?(?:\s?[ap]m)?\b/g, "")
    .replace(/(?:https?:\/\/|[a-z]:\\|(?:~|\.{1,2})?\/)[^\s"'<>),;?]+|\b[\w.-]+(?:[/\\][\w.-]+)+/g, "")
    .replace(/\b[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}\b|\b(?:0x[\da-f]+|(?=[\da-f]*\d)[\da-f]{7,64}|t\d+[a-z\d]*|(?:task|job|run|request|session|agent|id)[_-][\w-]*\d[\w-]*)\b/g, "")
    .replace(/\d+/g, "")
    .replace(/[^\p{L}\p{M}]+/gu, " ")
    .trim();
}

export function inspectPrompt(agent, screen) {
  const tail = String(screen).trimEnd().split("\n").slice(-30).join("\n");
  const kind = lookupHarness(agent.app)?.prompt.classify(screen, agent).kind ?? "unknown";
  if (kind === "form") return { kind, form: true };
  if (kind !== "text") return { kind };
  const lines = tail.split("\n").map((line) => line.trim())
    .filter((line) => /[\p{L}\p{N}]/u.test(line) && !/^(?:[›❯>]|esc to|enter to|[?] for shortcuts)/i.test(line));
  const reported = agent.msg?.trim();
  const message = reported && !/^(?:waiting|blocked|permission|question)(?: on you| for (?:approval|permission|confirmation|input))?[.!:]?$/i.test(reported)
    ? reported
    : lines.findLast((line) => /\?$/.test(line)) ?? lines.at(-1) ?? "";
  return {
    kind,
    message,
    key: normalizeMessage(message),
    permission: PERMISSION.test([agent.kind, message, ...lines.slice(-8)].join(" ")),
  };
}

export function groupPrompts(entries) {
  const groups = new Map();
  for (const { agent, prompt } of entries) {
    if (prompt.kind !== "text" || !prompt.key) continue;
    if (!groups.has(prompt.key)) groups.set(prompt.key, { ...prompt, agents: [] });
    const group = groups.get(prompt.key);
    group.permission ||= prompt.permission;
    group.agents.push(agent);
  }
  return [...groups.values()];
}
