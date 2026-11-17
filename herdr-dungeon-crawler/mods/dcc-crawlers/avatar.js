// The animated portrait, shared by the sidebar (56px tile, 2x sprite) and the pane headers (30px tile, 1x sprite).
// Native motion only (loops and frames), so it costs no script time while it plays.
//   working: bobs along (a run cycle)        blocked: jitters, with a blinking "!"
//   done:    hops, with sparkles around it   idle:    breathes slowly, "z z Z" drifts up
import { div, image } from "gpui-kit";
import { sprite } from "./cast.js";

export function avatar(t, status, c, size = 56) {
  const img = size >= 44 ? 48 : 24; // sprites are 24x24: draw at whole multiples so pixels stay crisp
  const inner = size - 2; // inside the 1px border
  const room = Math.max(2, inner - img); // free space to move in
  const half = Math.round(room / 2);
  const s = status;

  let body = div().absolute().w(img).h(img).child(image(sprite(c)).w(img).h(img));
  if (s === "working") body = body.left(half).loop("top", { from: room, to: 0, period: 420, easing: "ease-out" });
  else if (s === "blocked") body = body.top(half).loop("left", { from: 0, to: room, period: 150, easing: "linear" });
  else if (s === "done") body = body.left(half).loop("top", { from: room, to: -Math.round(room / 2), period: 650, easing: "ease-out" });
  else body = body.left(half).loop("top", { from: room - 2, to: room, period: 2600 });

  const sp = Math.max(5, Math.round(size / 7));
  const bar = Math.max(1, Math.round(sp / 4));
  const mid = Math.floor((sp - bar) / 2);
  const at = (f) => Math.round(f * inner);
  const sparkle = (fx, fy, period, color) =>
    div().absolute().left(at(fx)).top(at(fy)).w(sp).h(sp).loop("opacity", { from: 0, to: 1, period })
      .child(div().absolute().left(mid).top(0).w(bar).h(sp).bg(color))
      .child(div().absolute().left(0).top(mid).w(sp).h(bar).bg(color));

  // A floor badge ("F2") in the bottom-right corner, for a character tied to a floor (Mordecai's bodies).
  const bw = Math.max(15, Math.round(size * 0.36));
  const bh = Math.max(10, Math.round(size * 0.24));
  const badge = () =>
    div().absolute().left(inner - bw).top(inner - bh).w(bw).h(bh).rounded(2).bg(c.color).flex().items_center().justify_center()
      .text_size(Math.max(7, Math.round(size * 0.17))).font_semibold().text_color("#140a06").child(`F${c.floor}`);

  return div().relative().flex_none().size(size).rounded(4).overflow_hidden()
    .bg(c.color + "26").border_1().border_color(s === "blocked" ? t.blocked : c.color)
    .child(body)
    .when(s === "blocked", (el) =>
      el.child(div().absolute().left(at(0.74)).top(0).text_size(Math.max(10, size * 0.32)).font_semibold().text_color(t.blocked).loop("opacity", { from: 0.1, to: 1, period: 500 }).child("!")))
    .when(s === "done", (el) =>
      el.child(sparkle(0.02, 0.04, 700, t.accent)).child(sparkle(0.76, 0.08, 950, "#fff2b0")).child(sparkle(0.72, 0.72, 1250, t.accent)).child(sparkle(0.04, 0.7, 820, "#fff2b0")))
    .when(s === "idle", (el) =>
      el.child(div().absolute().left(at(0.62)).top(2).text_size(Math.max(7, size * 0.22)).font_semibold().text_color(t.muted).frames(["z", "z z", "z z Z", "z z Z"], 800)))
    .when(c.floor != null, (el) => el.child(badge()));
}
