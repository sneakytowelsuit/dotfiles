// Reads Claude Code usage numbers for local agents and keeps them fresh. Only usage numbers, model names and
// timestamps are extracted from the session transcript (~/.claude/projects/<folder>/*.jsonl), by jq, in the shell:
// message text never reaches this module. Needs `jq` on the PATH (without it, nothing is shown).
import { exec, terminals, panes, spaces, shared } from "herdr";
import { parseTurns, addTurn, emptyTotals, metrics, cacheTimer, KEEP_TURNS } from "./usage.js";

export const REFRESH_MS = 20000; // each agent is re-read at most this often (sooner when its status changes)
const FIRST_SCAN_BYTES = 20000000; // a first read looks at no more than the last 20 MB of a transcript
const MAX_PARALLEL = 3;

// $1 project folder name, $2 the transcript read last time, $3 how far into it we got. Prints three header lines
// (file, next offset, start offset) then one compact JSON line per assistant response: usage numbers only.
// Reads only the bytes added since last time; stops before an unfinished last line.
const SCRIPT = [
  'command -v jq >/dev/null || exit 3',
  'f=$(ls -t "$HOME/.claude/projects/$1"/*.jsonl 2>/dev/null | head -n 1); [ -n "$f" ] || exit 0',
  'sz=$(wc -c < "$f"); start=0',
  `if [ "$f" = "$2" ] && [ "\${3:-0}" -le "$sz" ]; then start=$3; elif [ "$sz" -gt ${FIRST_SCAN_BYTES} ]; then start=$((sz-${FIRST_SCAN_BYTES})); fi`,
  'next=$sz; if [ -n "$(tail -c 1 "$f")" ]; then p=$(tail -n 1 "$f" | wc -c); next=$((sz-p)); fi',
  'printf "%s\\n%s\\n%s\\n" "$f" "$next" "$start"',
  '[ "$next" -gt "$start" ] || exit 0',
  'head -c "$next" "$f" | tail -c +$((start+1)) | grep -a \'"usage"\' | ' +
    "jq -cR 'fromjson? | select(.type==\"assistant\" and (.message.usage|type)==\"object\" and .isSidechain!=true) | " +
    "{type, timestamp, message:{id:.message.id, model:.message.model, usage:(.message.usage|{input_tokens,output_tokens,cache_creation_input_tokens,cache_read_input_tokens,cache_creation})}}'",
].join("\n");

const state = new Map(); // address -> { file, offset, partial, totals, turns, lastRec, status, at, u, busy }
let running = false;

const projectDir = (cwd) => cwd.replace(/[^A-Za-z0-9]/g, "-");

function cwdOf(node) {
  const x = terminals().find((t) => t.address === node.address);
  return x?.cwd ?? x?.foreground?.cwd ?? (node.pane ? panes().find((p) => p.pane === node.pane)?.cwd : null) ?? null;
}
const isRemote = (node) => Boolean(node.space && spaces().find((s) => s.id === node.space)?.machine) || /[/:]/.test(node.address);

async function refresh(node, now) {
  const cwd = cwdOf(node);
  let s = state.get(node.address);
  if (!s) state.set(node.address, (s = { file: "", offset: 0, partial: false, totals: emptyTotals(), turns: [], lastRec: null, u: null, at: 0, status: null }));
  s.at = now; s.status = node.raw ?? node.status;
  if (!cwd) { s.u = null; return; }
  let out;
  try { out = (await exec("sh", ["-c", SCRIPT, "sh", projectDir(cwd), s.file, String(s.offset)], { timeout: 60000 })).stdout; } catch { return; }
  const lines = out.split("\n");
  const [file, next, start] = lines;
  if (!file) { s.u = null; return; }
  if (file !== s.file || Number(start) === 0 || Number(start) !== s.offset) {
    // a different session (or a first read, or a rewound file): start over
    s.totals = emptyTotals(); s.turns = []; s.lastRec = null; s.partial = Number(start) > 0;
  }
  s.file = file; s.offset = Number(next) || 0;
  const fresh = parseTurns(lines.slice(3));
  for (const r of fresh) {
    // A response streamed across the read boundary shows up twice: replace the earlier count.
    if (s.lastRec && r.id && r.id === s.lastRec.id) { addTurn(s.totals, s.lastRec, -1); s.turns.pop(); }
    addTurn(s.totals, r); s.turns.push(r); s.lastRec = r;
  }
  if (s.turns.length > KEEP_TURNS) s.turns = s.turns.slice(-KEEP_TURNS);
  s.u = metrics(s.turns, { totals: s.totals, now, partial: s.partial });
}

/**
 * Refresh usage for the Claude Code agents among `nodes` (conduct model nodes), at most every REFRESH_MS each,
 * or at once when an agent's status changed. Resolves with Map address -> metrics (see usage.js `metrics`) for
 * every local Claude Code agent with a transcript. Call it from the 4-second poller without awaiting:
 *   pollUsage(list).then((m) => setShared("conduct.usage", Object.fromEntries(m))).catch(() => {});
 * A call that overlaps a running one returns the cache.
 */
export async function pollUsage(nodes, now = Date.now()) {
  const mine = nodes.filter((n) => n.app === "claude-code" && !isRemote(n));
  const alive = new Set(mine.map((n) => n.address));
  for (const a of [...state.keys()]) if (!alive.has(a)) state.delete(a);
  if (!running) {
    running = true;
    try {
      const due = mine.filter((n) => { const s = state.get(n.address); return !s || now - s.at >= REFRESH_MS || s.status !== (n.raw ?? n.status); });
      for (let i = 0; i < due.length; i += MAX_PARALLEL) await Promise.all(due.slice(i, i + MAX_PARALLEL).map((n) => refresh(n, now).catch(() => {})));
    } finally { running = false; }
  }
  return new Map(mine.filter((n) => state.get(n.address)?.u).map((n) => [n.address, state.get(n.address).u]));
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
