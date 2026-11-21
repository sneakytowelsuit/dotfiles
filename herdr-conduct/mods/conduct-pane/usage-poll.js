// Reads local usage through jq and passes only token counts, model names and timestamps to the mod.
import { hc, exec, terminals, panes, spaces, shared } from "herdr";
import { parseTurns, addTurn, emptyTotals, metrics, codexMetrics, cacheTimer, KEEP_TURNS } from "./usage.js";
import { lookupHarness } from "./harnesses.js";

export const REFRESH_MS = 20000; // each agent is re-read at most this often (sooner when its status changes)
const MAX_PARALLEL = 3;

const state = new Map(); // address -> { file, offset, partial, totals, turns, lastRec, status, at, u }
let running = false;

function cwdOf(node) {
  const x = terminals().find((t) => t.address === node.address);
  // The folder the agent process runs in (what Claude Code names its project folder after), not the folder the shell
  // in that terminal started in.
  return x?.foreground?.cwd ?? (node.pane ? panes().find((p) => p.pane === node.pane)?.cwd : null) ?? x?.cwd ?? null;
}
const isRemote = (node) => Boolean(node.space && spaces().find((s) => s.id === node.space)?.machine) || /[/:]/.test(node.address);

async function refresh(node, usage, now) {
  let s = state.get(node.address);
  if (!s) state.set(node.address, (s = { file: "", offset: 0, partial: false, totals: emptyTotals(), turns: [], lastRec: null, u: null, at: 0, status: null }));
  s.at = now; s.status = node.raw ?? node.status;
  s.u = await usage.read({
    node, state: s, now, cwdOf, hc, exec, emptyTotals, parseTurns, addTurn, metrics, codexMetrics, keepTurns: KEEP_TURNS,
  });
}

/**
 * Refresh usage for supported agents among `nodes` (conduct model nodes), at most every REFRESH_MS each,
 * or at once when an agent's status changed. Resolves with Map address -> metrics (see usage.js `metrics`) for
 * every supported local agent with a transcript. Call it from the 4-second poller without awaiting:
 *   pollUsage(list).then((m) => setShared("conduct.usage", Object.fromEntries(m))).catch(() => {});
 * A call that overlaps a running one returns the cache.
 */
export async function pollUsage(nodes, now = Date.now()) {
  const mine = nodes.map((node) => ({ node, usage: lookupHarness(node.app)?.usage }))
    .filter(({ node, usage }) => usage && !isRemote(node));
  const alive = new Set(mine.map(({ node }) => node.address));
  for (const a of [...state.keys()]) if (!alive.has(a)) state.delete(a);
  if (!running) {
    running = true;
    try {
      const due = mine.filter(({ node: n }) => { const s = state.get(n.address); return !s || now - s.at >= REFRESH_MS || s.status !== (n.raw ?? n.status); });
      for (let i = 0; i < due.length; i += MAX_PARALLEL) await Promise.all(due.slice(i, i + MAX_PARALLEL).map(({ node, usage }) => refresh(node, usage, now).catch(() => {})));
    } finally { running = false; }
  }
  return new Map(mine.map(({ node }) => [node.address, state.get(node.address)?.u]).filter(([, usage]) => usage));
}

/** What is stored for one agent in the shared value, plus the cache countdown worked out now. No I/O. */
export function readUsage(address, now = Date.now()) {
  const u = (shared("conduct.usage") ?? {})[address];
  return u ? { ...u, live: cacheTimer(u.cache, now) } : null;
}
/** The whole shared map ({ address: usage }), each with its live countdown. */
export function readAllUsage(now = Date.now()) {
  const o = shared("conduct.usage") ?? {};
  return Object.fromEntries(Object.entries(o).filter(([, u]) => u).map(([a, u]) => [a, { ...u, live: cacheTimer(u.cache, now) }]));
}
