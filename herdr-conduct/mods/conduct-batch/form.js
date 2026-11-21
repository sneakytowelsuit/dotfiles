import { lookupHarness } from "./harnesses.js";

// Legacy screen-only parser. Runtime callers classify against current agent state.
export function parseForm(text, app) {
  return lookupHarness(app || "claude-code")?.prompt.parse?.(text) ?? null;
}

export function codexApprovalKey(text, shown, num) {
  return lookupHarness("codex").prompt.choiceKeys(text, shown, num)?.[0] ?? null;
}

// What `hc keys` can type: it has no names for ! ? ( ) : _ " @ # $ % ^ & * ~ | { } < > + and shifted symbols.
const KEY = { " ": "space" };
const PLAIN = new Set([..."abcdefghijklmnopqrstuvwxyz0123456789,.'-=/\;[]`"]);
export function keyFor(ch) {
  if (KEY[ch]) return KEY[ch];
  if (PLAIN.has(ch)) return ch;
  if (/^[A-Z]$/.test(ch)) return `shift+${ch.toLowerCase()}`;
  return null;
}
export const canType = (text) => [...text].every((c) => keyFor(c) !== null);
export const keysFor = (text) => [...text].map(keyFor);
