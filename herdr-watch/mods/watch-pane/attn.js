// Shared by watch-bar and watch-queue (copied by sync-shared.sh; edit the copy in watch-bar/).
// What needs the person: an agent that is blocked (waiting on input) or done (finished while unseen).

import { div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { run } from "herdr";

export const ORDER = ["blocked", "done", "working", "idle"];
export const NAME = { blocked: "BLOCKED", done: "REVIEW", working: "WORKING", idle: "IDLE" };
export const SAYS = { blocked: "needs your input", done: "finished, unseen", working: "working", idle: "idle" };
export const needs = (a) => a.status === "blocked" || a.status === "done";

/** Agents, most urgent first; ties keep the app's order. */
export function sorted(list) {
  return list.map((a, i) => [a, i]).sort((x, y) => ORDER.indexOf(x[0].status) - ORDER.indexOf(y[0].status) || x[1] - y[1]).map((x) => x[0]);
}

/** The status's color from the theme. */
export const colorOf = (t, s) => (s === "idle" ? t.dim : t[s] ?? t.dim);

/** Readable ink on a filled color. */
export function ink(hex) {
  const m = /^#([0-9a-f]{6})/i.exec(hex ?? "");
  if (!m) return "#0b0b0b";
  const n = parseInt(m[1], 16);
  const l = (0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  return l > 0.55 ? "#0b0b0b" : "#ffffff";
}

/** Take the person to an agent: its space, its tab, its pane. */
export function go(a) {
  run("space.select", { id: a.space });
  run("tab.select", { id: a.tab });
  run("pane.focus", { pane: a.pane });
}

/** The agent after the focused one among those needing attention (dir -1: before). Null if none. */
export function nextNeeding(list, dir = 1) {
  const q = sorted(list).filter(needs);
  if (!q.length) return null;
  const at = q.findIndex((a) => a.focused);
  if (at < 0) return dir > 0 ? q[0] : q[q.length - 1];
  return q[(at + dir + q.length) % q.length];
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
