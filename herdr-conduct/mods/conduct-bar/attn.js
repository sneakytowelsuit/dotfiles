// Shared by every conduct mod (copied by sync-shared.sh; edit the copy in conduct-bar/).
// The model: agents from herdr-core's terminal list (which, unlike agents(), includes sub-agents),
// each with an effective status, what it says it's doing, how long it has been in that state,
// and whether you've seen it since it changed.

import { div } from "gpui-kit";
import { agents, terminals, spaces, panes, run, shared, setShared, hc } from "herdr";

// Most urgent first. "stalled" is a working agent whose screen has stopped changing (see conduct-queue).
export const ORDER = ["blocked", "error", "stalled", "done", "working", "idle"];
export const NAME = { blocked: "BLOCKED", error: "ERROR", stalled: "STUCK?", done: "REVIEW", working: "WORKING", idle: "IDLE" };
export const SAYS = {
  blocked: "waiting on you", error: "hit an error", stalled: "working, but quiet for a while",
  done: "finished while you weren't looking", working: "working", idle: "idle",
};
export const needs = (a) => ORDER.indexOf(a.status) <= ORDER.indexOf("done");
export const STALL_MS = 180000; // quiet this long while "working" = probably stuck (shared "conduct.stall_ms" overrides)

export function colorOf(t, s) {
  switch (s) {
    case "blocked": return t.blocked;
    case "error": return t.ansi1 ?? t.blocked;
    case "stalled": return t.ansi13 ?? t.ansi5 ?? t.blocked;
    case "done": return t.done;
    case "working": return t.working;
    default: return t.dim;
  }
}

/** Readable ink on a filled color. */
export function ink(hex) {
  const m = /^#([0-9a-f]{6})/i.exec(hex ?? "");
  if (!m) return "#0b0b0b";
  const n = parseInt(m[1], 16);
  const l = (0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  return l > 0.55 ? "#0b0b0b" : "#ffffff";
}

export function age(ms) {
  if (ms == null) return "";
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

/**
 * Every agent as a node, linked into a tree.
 * { address, parent, children, status, raw, msg, kind, title, name, app, space, spaceName, tab, tabName,
 *   pane (roots only), focused, since, unseen, primary }
 * `primary`: has sub-agents and no parent agent. Sub-agents have no pane: they sit in their parent's tab.
 */
export function model() {
  const ag = new Map(agents().map((a) => [a.address, a]));
  const all = terminals().filter((x) => x.state === "live");
  const byAddr = new Map(all.map((x) => [x.address, x]));
  const stalled = new Set(shared("conduct.stalled") ?? []);
  const sinceMap = shared("conduct.since") ?? {};
  const seen = shared("conduct.seen") ?? {};
  const sp = spaces();
  const pn = panes();

  const nodes = new Map();
  for (const x of all) {
    const raw = typeof x.status === "string" ? x.status : x.status?.state;
    if (!raw) continue;
    const a = ag.get(x.address);
    const status = raw === "working" && stalled.has(x.address) ? "stalled" : raw;
    nodes.set(x.address, {
      address: x.address, parent: null, children: [], status, raw,
      msg: x.report?.msg ?? x.status?.msg ?? "",
      kind: x.report?.kind ?? x.status?.kind ?? null,
      title: x.title || a?.title || x.name || x.program?.name || x.address,
      name: x.name ?? null,
      app: x.report?.app ?? a?.app ?? null,
      appName: x.program?.name ?? a?.program?.name ?? "agent",
      focused: Boolean(a?.focused),
      _p: x.parent, _l: x.labels ?? {},
    });
  }
  // Link to the nearest ancestor that is itself an agent.
  for (const n of nodes.values()) {
    let p = n._p, hops = 0;
    while (p && !nodes.has(p) && hops++ < 8) p = byAddr.get(p)?.parent ?? null;
    if (p && nodes.has(p) && p !== n.address) { n.parent = p; nodes.get(p).children.push(n.address); }
  }
  // Where each one is: its own labels, else its ancestors'. Roots also have a pane.
  const where = (addr, hops = 0) => {
    const x = byAddr.get(addr);
    if (!x || hops > 8) return null;
    const L = x.labels ?? {};
    if (L["herdr.space"]) return { space: L["herdr.space"], tab: L["herdr.tab"] };
    return x.parent ? where(x.parent, hops + 1) : null;
  };
  for (const n of nodes.values()) {
    const w = where(n.address) ?? {};
    n.space = w.space ?? null;
    n.tab = w.tab ?? null;
    const s = sp.find((q) => q.id === n.space);
    n.spaceName = s?.name ?? "";
    n.tabName = s?.tabs.find((q) => q.id === n.tab)?.name ?? "";
    n.pane = pn.find((q) => q.terminal === n.address)?.pane ?? null;
    n.primary = !n.parent && n.children.length > 0;
    // The agent you talk to (a primary) or are looking at right now "finishes" after every reply: nothing for you to read.
    if (n.raw === "done" && (n.primary || n.focused)) n.status = "idle";
    n.since = sinceMap[n.address]?.status === n.raw ? sinceMap[n.address].t : null;
    n.unseen = needs(n) && seen[n.address] !== `${n.status}@${n.since ?? ""}`;
    delete n._p; delete n._l;
  }
  const list = [...nodes.values()];
  return { nodes: nodes, list, byAddr: nodes, primaries: list.filter((n) => n.primary) };
}

/** Most urgent first; ties keep the core's order. */
export function sorted(list) {
  return list.map((a, i) => [a, i]).sort((x, y) => ORDER.indexOf(x[0].status) - ORDER.indexOf(y[0].status) || x[1] - y[1]).map((x) => x[0]);
}

/** Remember that you've looked at an agent in its current state. */
export function markSeen(n) {
  const seen = { ...(shared("conduct.seen") ?? {}) };
  const mark = `${n.status}@${n.since ?? ""}`; // the state *and when it began*: blocked again later is unread again
  if (seen[n.address] === mark) return;
  seen[n.address] = mark;
  setShared("conduct.seen", seen);
}

/** Take the person to an agent: its space and tab, then its pane, or a peek for a sub-agent. */
export function go(n) {
  markSeen(n);
  if (n.space) run("space.select", { id: n.space });
  if (n.tab) run("tab.select", { id: n.tab });
  if (n.pane) run("pane.focus", { pane: n.pane });
  else run("terminal.peek", { terminal: n.address });
}

/** The agent after the focused one among those needing attention (dir -1: before). Null if none. */
export function nextNeeding(list, dir = 1) {
  const q = sorted(list).filter(needs);
  if (!q.length) return null;
  const at = q.findIndex((a) => a.focused);
  if (at < 0) return dir > 0 ? q[0] : q[q.length - 1];
  return q[(at + dir + q.length) % q.length];
}

/** Type a message to an agent, as you would. `force`: past the core's refusal to type into a blocked agent. */
export async function send(address, text, force = true) {
  const r = await hc(["send", address, text, ...(force ? ["--force"] : [])]);
  return r.code === 0;
}
export const interrupt = (address) => hc(["interrupt", address]);
/** Press keys in an agent's terminal (`hc keys`): digits, right, left, enter, esc. */
export const press = (address, ...keys) => hc(["keys", address, ...keys]);

/** Statuses the triage inbox treats as critical (REVIEW can be added from the inbox). */
export const CRITICAL = ["blocked", "error", "stalled"];

/** The message that asks a primary agent to look in on its sub-agents, in Herdr's own terms. */
export function nudgeText(primary, nodes) {
  const kids = primary.children.map((a) => nodes.get(a)).filter(Boolean);
  const bad = sorted(kids).filter(needs);
  const intro =
    "Herdr check-in. The IDs below (like t1z) are Herdr terminal addresses, not Claude, Codex or other harness session names. " +
    "Use the hc CLI on them: `hc ls` lists your sub-agents, `hc read <id>` shows one's screen, " +
    "`hc send <id> \"<text>\"` types to it, `hc interrupt <id>` presses its stop key.";
  if (!bad.length) return `${intro}\n\nNothing is flagged, but please run \`hc ls\`, \`hc read\` each sub-agent you started, and report each one's state.`;
  const line = (k) => {
    const head = `- ${k.address} "${k.title}": `;
    if (k.status === "blocked") return head + `blocked${k.kind ? ` (${k.kind})` : ""}${k.msg ? `: ${k.msg}` : ""}`;
    if (k.status === "error") return head + "hit an error";
    if (k.status === "stalled") return head + `says it is working but its screen hasn't changed${k.since ? ` for ${age(k.since)}` : ""}`;
    return head + "finished and its result hasn't been read";
  };
  return (
    `${intro}\n\nNeeds attention:\n${bad.map(line).join("\n")}\n\n` +
    "For each, `hc read` it, then unblock it, restart it, or tell me what you need from me. " +
    "If one is waiting on a permission or a question, ask me rather than answering for it. Report back when done."
  );
}

/**
 * A halo: soft rings behind a rounded child that breathe in and out. Needs-attention only.
 * `r` is the child's corner radius, `pad` how far the glow reaches.
 */
export function halo(color, r, pad, child) {
  return div()
    .relative()
    .flex_none()
    .p(pad)
    .child(div().absolute().inset(0).rounded(r + pad).bg(color + "22").loop("opacity", { from: 0.15, to: 1, period: 1300 }))
    .child(div().absolute().inset(Math.round(pad / 2)).rounded(r + Math.round(pad / 2)).bg(color + "44").loop("opacity", { from: 1, to: 0.2, period: 1300 }))
    .child(child);
}
