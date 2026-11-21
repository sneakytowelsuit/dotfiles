// Every conduct hotkey, its default, and how it is looked up. Shared by conduct-bar, conduct-triage and
// conduct-settings (copied by sync-shared.sh; edit the copy in conduct-bar/).
//   scope "global": bound by Herdr in keys.json, section "layout:conduct" (the settings mod edits that file)
//   scope "inbox":  matched by the inbox itself; overrides live in the shared value "conduct.keys"

import { shared, keys as herdrKeys } from "herdr";

export const ACTIONS = [
  { id: "g.inbox", scope: "global", label: "Open the inbox", command: "mod.open:conduct-triage", def: ["alt-t"] },
  { id: "g.next", scope: "global", label: "Next agent that needs you", command: "conduct-bar.next", def: ["alt-n"] },
  { id: "g.prev", scope: "global", label: "Previous agent that needs you", command: "conduct-bar.prev", def: ["alt-p"] },
  { id: "g.nudge", scope: "global", label: "Nudge a primary agent", command: "conduct-bar.nudge", def: ["alt-m"] },
  { id: "g.settings", scope: "global", label: "Open these settings", command: "mod.open:conduct-settings", def: ["alt-,"] },

  { id: "read", scope: "inbox", label: "Mark read", note: "in the Finished list: mark all read", def: ["r", "right"] },
  { id: "leave", scope: "inbox", label: "Leave unread, go on", def: ["u", "left"] },
  { id: "reply", scope: "inbox", label: "Reply (focus the text box)", def: ["i"] },
  { id: "go", scope: "inbox", label: "Go to the agent's terminal", def: ["g", "o"] },
  { id: "nudge", scope: "inbox", label: "Nudge this agent's primary", def: ["n"] },
  { id: "review", scope: "inbox", label: "Finished list on / off", def: ["d"] },
  { id: "raw", scope: "inbox", label: "Raw screen / form", def: ["v"] },
  { id: "back", scope: "inbox", label: "Previous question", def: ["b"] },
  { id: "skip", scope: "inbox", label: "Skip this question", def: ["s"] },
  { id: "enter", scope: "inbox", label: "Confirm / continue / submit", def: ["enter"] },
  { id: "close", scope: "inbox", label: "Close the inbox (or cancel a prompt)", def: ["escape", "q", "t"] },
];

export const byId = (id) => ACTIONS.find((a) => a.id === id);

/** The bindings in force now. Global ones come from what Herdr has loaded from keys.json. */
export function bindings(id) {
  const a = byId(id);
  if (!a) return [];
  if (a.scope === "global") {
    try { return herdrKeys().filter((k) => k.section === "layout:conduct" && k.action === a.command).map((k) => k.keys); } catch { return []; }
  }
  const o = shared("conduct.keys") ?? {};
  return Array.isArray(o[id]) ? o[id] : a.def;
}

/** Which inbox action a key press is, if any. */
export function inboxAction(keystroke) {
  const ks = String(keystroke ?? "").toLowerCase();
  for (const a of ACTIONS) if (a.scope === "inbox" && bindings(a.id).some((b) => b.toLowerCase() === ks)) return a.id;
  return null;
}

const GLYPH = { right: "→", left: "←", up: "↑", down: "↓", escape: "Esc", enter: "↵", space: "Space" };
export const pretty = (b) => (GLYPH[b.toLowerCase()] ?? b);
/** How a binding reads on a hint chip: "→ / r". */
export const show = (id) => bindings(id).map(pretty).join(" / ") || "unbound";
/** The first binding, for tooltips. */
export const first = (id) => (bindings(id)[0] ? pretty(bindings(id)[0]) : "unbound");

const MOD = /^(?:(?:ctrl|alt|shift|cmd|super|meta)-)*/i;
/** Is this a plausible key string? Returns an error message or null. */
export function checkBinding(b, scope) {
  if (!b) return "empty";
  if (/\s/.test(b)) return `"${b}" has a space (write modifiers like alt-shift-n)`;
  const key = b.replace(MOD, "");
  if (!key) return `"${b}" is only modifiers`;
  if (scope === "inbox" && /^[1-9]$/.test(key) && key === b) return `"${b}" is reserved: the number keys pick form options`;
  return null;
}
