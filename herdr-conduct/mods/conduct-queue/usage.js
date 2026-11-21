// Token usage, cache and cost maths for Conduct. Pure: no herdr imports (node-testable).
// Input: the usage numbers Claude Code records in its session transcript (one JSON line per API response).
// Only numbers, model names and timestamps are ever looked at; message text is never read.
// Shared by conduct-usage (copied by sync-shared.sh next to the mods that draw it; edit the copy in conduct-usage/).

// ---- EDIT POINTS ----------------------------------------------------------------------------------------------

// Context window by model. Current models have 1M; Haiku 4.5, Sonnet/Opus 4.5 and older have 200K.
export const WINDOW_SMALL = /claude-(?:3-|haiku-4|sonnet-4-5|opus-4-5|opus-4-1|(?:sonnet|opus)-4-\d{8})/;
export const WINDOW_SMALL_TOKENS = 200000;
export const WINDOW_BIG_TOKENS = 1000000;
export const windowFor = (model) => (WINDOW_SMALL.test(model ?? "") ? WINDOW_SMALL_TOKENS : WINDOW_BIG_TOKENS);

// Prices in USD per MILLION tokens, as of 2026-11 (public list prices; EDIT HERE when they change).
// in = fresh input, out = output, cr = cache read, c5 = cache write (5 minute TTL), c1 = cache write (1 hour TTL).
// Cache read is 0.1x input, a 5m write 1.25x, a 1h write 2x. Models are matched by family, first match wins.
// Models that match nothing use DEFAULT_PRICE and are flagged `known: false`.
export const PRICES = [
  { family: "opus-legacy", match: /opus-4-1|opus-4-\d{8}|claude-3-opus/, in: 15, out: 75, cr: 1.5, c5: 18.75, c1: 30 },
  { family: "opus", match: /opus|fable/, in: 5, out: 25, cr: 0.5, c5: 6.25, c1: 10 },
  { family: "sonnet", match: /sonnet/, in: 3, out: 15, cr: 0.3, c5: 3.75, c1: 6 },
  { family: "haiku", match: /haiku/, in: 1, out: 5, cr: 0.1, c5: 1.25, c1: 2 },
];
export const DEFAULT_PRICE = { family: "unknown", in: 3, out: 15, cr: 0.3, c5: 3.75, c1: 6 };

// Prompt cache lifetime since its last use. 1 hour when the recent turns wrote 1h cache entries.
export const TTL_5M = 300;
export const TTL_1H = 3600;
export const COOLING_SECS = 60; // warm -> cooling below this many seconds left...
export const COOLING_FRAC = 0.25; // ...or below this fraction of the TTL
export const NEAR_FULL = 0.9; // context "near full" (fraction used)
export const HIT = 0.9; // a turn is a cache hit at this ratio or above
export const MISS = 0.3; // ...a miss below this, partial between
export const SEQ_LEN = 10;
export const KEEP_TURNS = 40; // turns kept per agent for the recent-window maths
export const RATE_WINDOW_MS = 600000;

// ---- parsing --------------------------------------------------------------------------------------------------

const n0 = (v) => (typeof v === "number" && isFinite(v) && v > 0 ? v : 0);

/** One transcript line (object) -> a turn record, or null if it is not an assistant response with usage. */
export function toTurn(d) {
  const m = d?.message;
  const u = m?.usage;
  if (!u || typeof u !== "object" || d.isSidechain === true) return null;
  if (d.type && d.type !== "assistant") return null;
  const t = Date.parse(d.timestamp);
  if (!isFinite(t)) return null;
  if (m.model === "<synthetic>") return null;
  const cc = n0(u.cache_creation_input_tokens);
  const cr5 = u.cache_creation && typeof u.cache_creation === "object" ? n0(u.cache_creation.ephemeral_5m_input_tokens) : null;
  const cr1 = u.cache_creation && typeof u.cache_creation === "object" ? n0(u.cache_creation.ephemeral_1h_input_tokens) : null;
  // No breakdown: the whole creation count is the default 5 minute kind. A breakdown short of the total: the rest is 5m.
  const c1 = cr1 ?? 0;
  const c5 = cr5 == null ? Math.max(0, cc - c1) : Math.max(cr5, cc - c1);
  return {
    id: typeof m.id === "string" ? m.id : null,
    t, model: typeof m.model === "string" ? m.model : null,
    input: n0(u.input_tokens), output: n0(u.output_tokens), cacheRead: n0(u.cache_read_input_tokens),
    cacheCreate5m: c5, cacheCreate1h: c1,
  };
}

/**
 * Transcript lines (a string with newlines, or an array of strings/objects) -> turn records in time order.
 * Unparseable lines (a cut-off first line of a tail) are skipped. Streamed responses write the same message
 * several times: records with the same id collapse to the last one.
 */
export function parseTurns(input) {
  const lines = Array.isArray(input) ? input : String(input ?? "").split("\n");
  const out = [];
  const at = new Map();
  for (const l of lines) {
    let d = l;
    if (typeof l === "string") { if (!l.trim()) continue; try { d = JSON.parse(l); } catch { continue; } }
    const r = toTurn(d);
    if (!r) continue;
    if (r.id && at.has(r.id)) out[at.get(r.id)] = r;
    else { if (r.id) at.set(r.id, out.length); out.push(r); }
  }
  return out.sort((a, b) => a.t - b.t);
}

/** Normalize the filtered Codex token events. The cumulative counter identifies repeated snapshots. */
export function codexMetrics(lines, now = Date.now()) {
  const records = new Map();
  let model = null;
  for (const line of lines) {
    let d;
    try { d = JSON.parse(line); } catch { continue; }
    if (typeof d?.model === "string") { model = d.model; continue; }
    const t = Date.parse(d?.t);
    if (!isFinite(t) || !n0(d?.window) || !n0(d?.cumulative) || !n0(d?.input)) continue;
    const cacheRead = Math.min(d.input, n0(d.cached));
    records.set(d.cumulative, {
      t, model, input: d.input - cacheRead, cacheRead, output: n0(d.output),
      cacheCreate5m: 0, cacheCreate1h: 0, window: d.window,
    });
  }
  const turns = [...records.values()].slice(-KEEP_TURNS);
  return metrics(turns, { now, measuredOnly: true });
}

// ---- pricing --------------------------------------------------------------------------------------------------

export function priceFor(model) {
  const p = PRICES.find((x) => x.match.test(model ?? ""));
  return p ? { ...p, known: true } : { ...DEFAULT_PRICE, known: false };
}

/** USD for the tokens of one turn (or of a totals bucket: same field names). */
export function costOf(r) {
  const p = priceFor(r.model);
  return (r.input * p.in + r.output * p.out + r.cacheRead * p.cr + r.cacheCreate5m * p.c5 + r.cacheCreate1h * p.c1) / 1e6;
}
/** What the cache reads would have cost at the full input price, minus what they cost. */
export function savingsOf(r) {
  const p = priceFor(r.model);
  return (r.cacheRead * (p.in - p.cr)) / 1e6;
}

/** Running totals per model, so a long session never needs its whole history in memory. */
export const emptyTotals = () => ({});
export function addTurn(totals, r, sign = 1) {
  const k = r.model ?? "unknown";
  const b = (totals[k] ??= { model: r.model, n: 0, input: 0, output: 0, cacheRead: 0, cacheCreate5m: 0, cacheCreate1h: 0 });
  b.n += sign;
  for (const f of ["input", "output", "cacheRead", "cacheCreate5m", "cacheCreate1h"]) b[f] += sign * r[f];
  return totals;
}
export const totalCost = (totals) => Object.values(totals).reduce((s, b) => s + costOf(b), 0);
export const totalSavings = (totals) => Object.values(totals).reduce((s, b) => s + savingsOf(b), 0);

// ---- per-agent metrics ----------------------------------------------------------------------------------------

const ctxTokens = (r) => r.input + r.cacheRead + r.cacheCreate5m + r.cacheCreate1h;
const round = (x, d = 4) => (isFinite(x) ? Math.round(x * 10 ** d) / 10 ** d : 0);

/** Cache hit ratio of one turn: read / (read + created + fresh input). 0 when nothing was processed. */
export function hitRatio(r) {
  const all = ctxTokens(r);
  return all > 0 ? r.cacheRead / all : 0;
}
export const outcome = (ratio) => (ratio >= HIT ? "hit" : ratio >= MISS ? "partial" : "miss");

/** Cache lifetime in seconds for these turns: 1h when the latest turn that wrote cache wrote 1h entries. */
export function ttlFor(turns) {
  for (let i = turns.length - 1; i >= 0; i--) {
    const r = turns[i];
    if (r.cacheCreate1h > 0) return TTL_1H;
    if (r.cacheCreate5m > 0) return TTL_5M;
  }
  return TTL_5M;
}

/** Turns of the current context stretch (a drop of more than 20% in context size = it was compacted/cleared). */
function stretch(turns) {
  let from = 0;
  for (let i = 1; i < turns.length; i++) if (ctxTokens(turns[i]) < 0.8 * ctxTokens(turns[i - 1])) from = i;
  return turns.slice(from);
}

/** Average context growth per turn over the last few turns of this stretch, or null. */
export function growthPerTurn(turns) {
  const s = stretch(turns).slice(-8);
  if (s.length < 2) return null;
  const g = (ctxTokens(s[s.length - 1]) - ctxTokens(s[0])) / (s.length - 1);
  return g > 0 ? g : null;
}

/**
 * Everything the UI shows about one agent, as small JSON (this is what goes in shared("conduct.usage")[address]).
 *   turns: recent turn records (time order); totals: per-model totals for the whole session (default: from turns);
 *   now: ms (injected for tests). Null when there are no turns.
 */
export function metrics(turns, { totals = null, now = Date.now(), partial = false, measuredOnly = false } = {}) {
  const ts = (turns ?? []).filter(Boolean);
  if (!ts.length) return null;
  const last = ts[ts.length - 1];
  const used = ctxTokens(last);
  const total = last.window ?? windowFor(last.model);
  const g = growthPerTurn(ts);
  const tot = measuredOnly ? null : totals ?? ts.reduce((a, r) => addTurn(a, r), emptyTotals());

  const recent = ts.slice(-SEQ_LEN);
  const sumAll = (a, f) => a.reduce((s, r) => s + r[f], 0);
  const rd = sumAll(recent, "cacheRead");
  const rall = recent.reduce((s, r) => s + ctxTokens(r), 0);
  const ttl = measuredOnly ? null : ttlFor(recent);
  const p = priceFor(last.model);
  const wr = ttl === TTL_1H ? p.c1 : p.c5;

  const inWin = ts.filter((r) => r.t >= now - RATE_WINDOW_MS);
  let rate = { tokPerMin: 0, costPerHour: measuredOnly ? null : 0 };
  if (inWin.length) {
    const mins = Math.min(10, Math.max(1, (now - inWin[0].t) / 60000));
    const tok = inWin.reduce((s, r) => s + r.input + r.output + r.cacheCreate5m + r.cacheCreate1h, 0);
    const cost = measuredOnly ? 0 : inWin.reduce((s, r) => s + costOf(r), 0);
    rate = { tokPerMin: Math.round(tok / mins), costPerHour: measuredOnly ? null : round((cost / mins) * 60, 3) };
  }

  return {
    ctx: { used, total, frac: round(used / total), left: Math.max(0, total - used), turnsLeft: g ? Math.floor(Math.max(0, total - used) / g) : null },
    cache: {
      ratio: round(rall > 0 ? rd / rall : 0), last: round(hitRatio(last)), seq: recent.map((r) => round(hitRatio(r), 2)),
      ttl, lastAt: last.t, coldExtra: measuredOnly ? null : round((used * Math.max(0, wr - p.cr)) / 1e6, 4),
    },
    cost: measuredOnly ? null : { session: round(totalCost(tot)), lastTurn: round(costOf(last)), savings: round(totalSavings(tot)), turns: Object.values(tot).reduce((s, b) => s + b.n, 0), known: p.known, partial },
    rate, model: last.model ?? "unknown", at: now,
  };
}

/** The cache countdown at `now` from stored metrics: { state: "warm"|"cooling"|"cold", remaining (s), frac, ttl }. No I/O. */
export function cacheTimer(c, now = Date.now()) {
  if (!c || !isFinite(c.lastAt) || !(c.ttl > 0)) return null;
  const remaining = Math.max(0, c.ttl - (now - c.lastAt) / 1000);
  const frac = remaining / c.ttl;
  const state = remaining <= 0 ? "cold" : remaining < COOLING_SECS || frac < COOLING_FRAC ? "cooling" : "warm";
  return { state, remaining, frac, ttl: c.ttl };
}

// ---- fleet ----------------------------------------------------------------------------------------------------

/** Totals over { address: metrics }. `working`: set of addresses currently working (for "cold while working"). */
export function fleet(map, { now = Date.now() } = {}) {
  let priced = 0, cost = 0, perHour = 0, savings = 0, rd = 0, all = 0, cold = 0, full = 0, agents = 0;
  for (const u of Object.values(map ?? {})) {
    if (!u) continue;
    agents++;
    if (u.cost) priced++;
    cost += u.cost?.session ?? 0; perHour += u.rate?.costPerHour ?? 0; savings += u.cost?.savings ?? 0;
    const w = Math.max(0.0001, u.ctx?.used ?? 0);
    rd += (u.cache?.ratio ?? 0) * w; all += w;
    if (cacheTimer(u.cache, now)?.state === "cold") cold++;
    if ((u.ctx?.frac ?? 0) >= NEAR_FULL) full++;
  }
  return { agents, priced, cost: round(cost), perHour: round(perHour, 3), savings: round(savings), ratio: round(all ? rd / all : 0), cold, full };
}

export const money = (x) => (x == null ? "" : x >= 100 ? `$${Math.round(x)}` : x >= 1 ? `$${x.toFixed(2)}` : x >= 0.01 ? `$${x.toFixed(2)}` : x > 0 ? "<$0.01" : "$0.00");
export const kilo = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(Math.round(n ?? 0)));
export const clock = (s) => (s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m` : s >= 60 ? `${Math.floor(s / 60)}m ${String(Math.floor(s % 60)).padStart(2, "0")}s` : `${Math.floor(s)}s`);
