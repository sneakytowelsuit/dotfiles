// Recovery actions through the `hc` CLI. Each returns { ok, text }. Herdr-dependent; the logic is in recover.js.
// Every function is async: call them from handlers as `() => fn()`.

import { hc, exec, shared, setShared } from "herdr";
import { STATUS_MESSAGE, shouldAutoNudge, restartSpec, runArgs, canResume, withContinue, tail, recordNudge, normConfig } from "./recover.js";

let clock = null;
/** Give the actions the AsyncContext from init(_p, cx) so they can wait with cx.timer (never a handler's cx). */
export const useClock = (cx) => { clock = cx; };
const sleep = (ms) => clock
  ? new Promise((r) => clock.timer.after(ms, () => r()))
  : exec("sleep", [String(ms / 1000)]).then(() => {}, () => {});

const fail = (text) => ({ ok: false, text });
const msg = (r) => (r.stderr || r.stdout || `exit ${r.code}`).trim().split("\n")[0];

/** Read the end of an agent's screen. */
export async function readTail(address, n = 14) {
  try {
    const r = await hc(["read", address]);
    return r.code === 0 ? tail(r.stdout, n) : "";
  } catch { return ""; }
}

/** Type the one-line status question without waiting for the answer (also what auto-nudge uses). */
export async function sendStatusCheck(address) {
  try {
    const r = await hc(["send", address, STATUS_MESSAGE]);
    return r.code === 0 ? { ok: true, text: "Asked for a one-line status." } : fail(`Couldn't send: ${msg(r)}`);
  } catch (e) { return fail(`Couldn't send: ${e.message ?? e}`); }
}

/** Ask for a status line, wait a few seconds, show what the screen says now. */
export async function statusCheck(address) {
  const s = await sendStatusCheck(address);
  if (!s.ok) return s;
  await sleep(5000);
  const t = await readTail(address, 8);
  return { ok: true, text: t ? `Asked for a status. The screen now ends:\n${t}` : "Asked for a status; nothing readable yet (look again in a moment)." };
}

/** Press the stop key, give it a moment, then the status check. */
export async function interruptThenCheck(address) {
  try {
    const r = await hc(["interrupt", address]);
    if (r.code !== 0) return fail(`Couldn't interrupt: ${msg(r)}`);
  } catch (e) { return fail(`Couldn't interrupt: ${e.message ?? e}`); }
  await sleep(1500);
  const s = await statusCheck(address);
  return { ok: s.ok, text: `Interrupted. ${s.text}` };
}

/** What a restart would do, from `hc get`: { spec } or { error }. */
export async function planRestart(address) {
  try {
    const r = await hc(["get", address, "--json"]);
    if (r.code !== 0) return { error: msg(r) };
    const spec = restartSpec(JSON.parse(r.stdout));
    return spec ? { spec } : { error: "its start command isn't known" };
  } catch (e) { return { error: String(e.message ?? e) }; }
}

/**
 * Kill it and start it again with the same name, folder, parent and flags. It LOSES its conversation unless
 * its program resumes itself. `resume`: use the harness-specific resume command.
 */
export async function restart(address, resume = false, app) {
  const { spec, error } = await planRestart(address);
  if (!spec) return fail(`Not restarted: ${error}.`);
  if (resume && !canResume(spec.argv, app)) return fail("Not restarted: this command no longer supports automatic resume.");
  const argv = resume ? withContinue(spec.argv, app) : spec.argv;
  const args = runArgs(spec, argv);
  try {
    const k = await hc(["kill", address]);
    if (k.code !== 0) return fail(`Couldn't end it, so nothing was started: ${msg(k)}`);
  } catch (e) { return fail(`Couldn't end it: ${e.message ?? e}`); }
  // A name is free again only once the old terminal is gone.
  for (let i = 0; i < 8; i++) {
    await sleep(400);
    try { const g = await hc(["get", address, "--json"]); if (g.code !== 0 || JSON.parse(g.stdout).state !== "live") break; } catch { break; }
  }
  try {
    const r = await hc(args);
    if (r.code !== 0) return fail(`It was ended but starting it again failed: ${msg(r)}\nBy hand: hc ${args.join(" ")}`);
    return { ok: true, text: `Restarted${resume ? " with resume" : ""}. It is a new terminal${spec.name ? ` named ${spec.name}` : ""}; its old address ${address} is gone.` };
  } catch (e) { return fail(`It was ended but starting it again failed: ${e.message ?? e}\nBy hand: hc ${args.join(" ")}`); }
}

export async function kill(address) {
  try {
    const r = await hc(["kill", address]);
    return r.code === 0 ? { ok: true, text: "Ended its program." } : fail(`Couldn't end it: ${msg(r)}`);
  } catch (e) { return fail(`Couldn't end it: ${e.message ?? e}`); }
}

/**
 * Poller hook (call every poll with the model's nodes and Date.now()): sends ONE status check per stall to
 * agents that qualify. Returns the addresses nudged.
 */
export async function autoNudgeTick(nodes, now) {
  const config = normConfig(shared("conduct.recover"));
  if (!config.autoNudge.on) return [];
  const done = [];
  for (const n of nodes.values()) {
    const state = shared("conduct.autonudge") ?? {};
    if (!shouldAutoNudge(n, config, now, state)) continue;
    setShared("conduct.autonudge", recordNudge(state, n, nodes)); // record first: never twice, even if the send is slow
    await sendStatusCheck(n.address);
    done.push(n.address);
  }
  return done;
}
