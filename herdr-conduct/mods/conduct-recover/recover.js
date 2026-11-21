// Recovery: pure logic (no herdr imports; node-tested).

const base = (p) => String(p ?? "").split("/").pop();
const SHELLS = new Set(["sh", "bash", "zsh", "fish", "dash", "nu", "ksh"]);
export const isShell = (argv) => SHELLS.has(base(argv?.[0]).replace(/^-/, ""));

/** Is this a Claude Code argv? (the wrapper is sometimes `.claude-wrapped`) */
export const isClaude = (argv) => /^\.?claude(-code)?(-wrapped)?$/.test(base(argv?.[0]));
const RESUME = new Set(["--continue", "-c", "--resume", "-r", "--from-pr", "--session-id"]);
export const hasResume = (argv) => (argv ?? []).some((a) => RESUME.has(a) || a.startsWith("--resume=") || a.startsWith("--session-id="));
/** Can "restart and resume" be offered? */
export const canResume = (argv) => isClaude(argv) && !hasResume(argv);
/** The argv with --continue right after the program (never after a prompt or `--`). */
export const withContinue = (argv) => (canResume(argv) ? [argv[0], "--continue", ...argv.slice(1)] : [...argv]);

/**
 * What to start again, from `hc get <t> --json`. Agents started from a shell have the shell as `argv` and the real
 * program as `foreground.argv`: use that one (viaShell) when the terminal itself is only a shell.
 */
export function restartSpec(get) {
  if (!get || typeof get !== "object") return null;
  let argv = Array.isArray(get.argv) ? get.argv : [];
  let cwd = get.cwd ?? null;
  let viaShell = false;
  const fg = get.foreground;
  if (isShell(argv) && Array.isArray(fg?.argv) && fg.argv.length && !isShell(fg.argv)) { argv = fg.argv; cwd = fg.cwd ?? cwd; viaShell = true; }
  if (!argv.length) return null;
  return {
    argv, cwd, viaShell,
    name: /^[a-z0-9_-]{1,32}$/.test(get.name ?? "") ? get.name : null,
    parent: get.parent ?? null,
    keep: Boolean(get.keep), notify: get.notify !== false, rm: Boolean(get.rm), dieWithParent: get.die_with_parent !== false,
  };
}

/** The `hc` arguments that start it again. */
export function runArgs(spec, argv = spec.argv) {
  return [
    "run", "--bg",
    ...(spec.name ? ["--name", spec.name] : []),
    ...(spec.cwd ? ["--cwd", spec.cwd] : []),
    ...(spec.parent ? ["--parent", spec.parent, ...(spec.dieWithParent ? [] : ["--outlive-parent"])] : ["--no-parent"]),
    ...(spec.keep ? ["--keep"] : []),
    ...(spec.notify ? [] : ["--no-notify"]),
    ...(spec.rm ? ["--rm"] : []),
    ...argv,
  ];
}

/** The last non-empty lines of a screen. */
export function tail(text, n = 12) {
  const lines = String(text ?? "").split("\n").map((l) => l.replace(/\s+$/, ""));
  while (lines.length && !lines[lines.length - 1]) lines.pop();
  return lines.slice(-n).join("\n");
}

export const STATUS_MESSAGE = "Herdr status check: reply with ONE line saying what you are doing and whether you are blocked.";

export const DEFAULT_CONFIG = { autoNudge: { on: false, minutes: 10 } };
/** conduct.recover merged over the defaults, with sane minutes. */
export function normConfig(c) {
  const m = Number(c?.autoNudge?.minutes);
  return { autoNudge: { on: Boolean(c?.autoNudge?.on), minutes: Number.isFinite(m) && m >= 1 ? Math.min(m, 600) : 10 } };
}

/** A stall is identified by when the agent's current state began. */
export const stallMark = (node) => `stalled@${node.since ?? ""}`;

/**
 * Send one status check to a stuck agent? Only when auto-nudge is on, the agent is STUCK? (never blocked/error/
 * anything else), has been for `minutes` (node.stuckSince if the poller knows it, else when the state began),
 * and this stall hasn't been nudged yet (state = conduct.autonudge).
 */
export function shouldAutoNudge(node, config, now, state) {
  const c = normConfig(config).autoNudge;
  if (!c.on || !node || node.status !== "stalled") return false;
  if (state?.[node.address] === stallMark(node)) return false;
  const from = node.stuckSince ?? node.since;
  if (from == null) return false;
  return now - from >= c.minutes * 60000;
}

/** Record a nudge (new state), and drop entries for agents that no longer are stalled/exist. */
export function recordNudge(state, node, nodes) {
  const out = {};
  for (const [a, m] of Object.entries(state ?? {})) {
    const n = nodes?.get ? nodes.get(a) : null;
    if (n && n.status === "stalled") out[a] = m;
  }
  out[node.address] = stallMark(node);
  return out;
}
