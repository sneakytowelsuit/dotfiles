// A small animated scene for each floor. Native loops only (opacity, left, top, width, height):
// they run without the script, so a dozen of them cost nothing.
import { div } from "gpui-kit";

const BG = ["#0e0c0a", "#121211", "#1a0a0e", "#0a0d11", "#17120a", "#080f08", "#070b11", "#091011", "#0d0c09", "#0d0d0f", "#12081a"];

const r = (x, y, w, h, bg) => div().absolute().left(Math.round(x)).top(Math.round(y)).w(Math.max(1, Math.round(w))).h(Math.max(1, Math.round(h))).bg(bg);
const dot = (x, y, s, bg) => r(x, y, s, s, bg).rounded_full();
const pulse = (el, a, b, period) => el.loop("opacity", { from: a, to: b, period });
const slide = (el, from, to, period) => el.loop("left", { from: Math.round(from), to: Math.round(to), period, easing: "linear" });

const SCENES = {
  // First Floor: concrete sectors, warm refuge doors, goblin machinery.
  1: (w, h) => {
    const k = [];
    for (const fx of [0.25, 0.5, 0.75]) k.push(r(fx * w, 0, 1, h, "#2a2118"));
    k.push(r(0, h * 0.5, w, 1, "#2a2118"));
    k.push(r(w * 0.38, h * 0.55, w * 0.22, h * 0.3, "#3a1a12"));
    for (const [fx, fy, per] of [[0.1, 0.18, 1800], [0.64, 0.12, 2200], [0.86, 0.6, 2600]]) {
      k.push(pulse(dot(fx * w - 8, fy * h - 8, 26, "#f0983a22"), 0.3, 1, per));
      k.push(pulse(r(fx * w, fy * h, 8, 14, "#f0983a"), 0.55, 1, per));
    }
    k.push(slide(dot(0, h * 0.72, 6, "#6ac24a"), w * 0.38, w * 0.56, 2600));
    return k;
  },
  // Second Floor: white floor, cinderblock, orange lichen, glowing shafts.
  2: (w, h) => {
    const k = [];
    for (let row = 0; row < 6; row++)
      for (let x = (row % 2) * -10; x < w; x += 22) k.push(r(x, row * 10, 20, 8, "#2c2c28"));
    k.push(r(0, h * 0.72, w, h * 0.28, "#cfcfc8"));
    for (const [fx, fy, per] of [[0.12, 0.2, 2400], [0.52, 0.45, 3100], [0.88, 0.1, 2800]])
      k.push(pulse(dot(fx * w, fy * h, 14, "#e87a2a").rounded(7), 0.4, 1, per));
    k.push(pulse(r(w * 0.3, 0, 5, h * 0.72, "#ffffff"), 0.1, 0.55, 2000));
    k.push(pulse(r(w * 0.76, 0, 5, h * 0.72, "#ffffff"), 0.1, 0.55, 2700));
    return k;
  },
  // The Over City: a simulated red sun, wooden skyline, a big top, a neon sign.
  3: (w, h) => {
    const k = [];
    k.push(pulse(dot(w * 0.66, h * 0.06, h * 0.55, "#ff3a2a"), 0.7, 1, 3200));
    [[0, 0.3], [0.07, 0.48], [0.15, 0.26], [0.22, 0.4], [0.62, 0.34], [0.72, 0.5], [0.83, 0.3], [0.92, 0.42]]
      .forEach(([fx, fh]) => k.push(r(fx * w, h * (1 - fh), w * 0.07, h * fh, "#2a1217")));
    const tx = w * 0.42;
    k.push(r(tx, h * 0.62, 44, h * 0.38, "#c43a3a"), r(tx + 6, h * 0.46, 32, h * 0.16, "#f2e6d8"), r(tx + 13, h * 0.32, 18, h * 0.14, "#c43a3a"), r(tx + 21, h * 0.18, 2, h * 0.14, "#f2c230"));
    k.push(pulse(div().absolute().left(8).top(h * 0.6).text_size(9).font_semibold().text_color("#ff3a9a").child("DESPERADO"), 0.25, 1, 800));
    return k;
  },
  // Iron Tangle: colored rail lines, named trains, a void in the middle.
  4: (w, h) => {
    const lines = [["#e5413a", 0.16, 7000], ["#3a8ee5", 0.38, 9400], ["#3ac26a", 0.6, 6200], ["#f2c230", 0.82, 8600]];
    const rails = [], ticks = [], trains = [];
    lines.forEach(([c, fy, per]) => {
      const y = Math.round(fy * h);
      rails.push(r(0, y, w, 2, c + "99"));
      for (const fx of [0.15, 0.5, 0.85]) ticks.push(r(fx * w - 1, y - 3, 3, 8, "#cfd8e3"));
      trains.push(
        slide(
          div().absolute().top(y - 9).left(-44).w(40).h(10).rounded(2).bg(c)
            .child(r(4, 3, 6, 4, "#dfe8f0")).child(r(14, 3, 6, 4, "#dfe8f0")).child(r(24, 3, 6, 4, "#dfe8f0")),
          -44, w + 4, per),
      );
    });
    const abyss = div().absolute().left(Math.round(w * 0.5) - 15).top(Math.round(h * 0.5) - 15).w(30).h(30).rounded_full().bg("#000000").border_1().border_color("#2b3a49");
    return [...rails, ...ticks, abyss, ...trains];
  },
  // The Bubbles: four quadrants (air, land, sea, underground), a storm and drifting sand.
  5: (w, h) => {
    const k = [
      r(0, 0, w / 2, h / 2, "#d9b46a33"), r(w / 2, 0, w / 2, h / 2, "#5a7a3a44"),
      r(0, h / 2, w / 2, h / 2, "#2a6a9a55"), r(w / 2, h / 2, w / 2, h / 2, "#3a2a2055"),
      r(w / 2, 0, 1, h, "#e0b45c55"), r(0, h / 2, w, 1, "#e0b45c55"),
    ];
    [[0.05, 0.2, 3400], [0.1, 0.34, 2600], [0.02, 0.1, 4200]].forEach(([fx, fy, per]) => k.push(slide(dot(0, fy * h, 3, "#e0b45c"), w * fx, w * 0.46, per)));
    k.push(pulse(r(w * 0.7, 0, 2, h * 0.5, "#9ff0ff"), 0, 1, 1600), pulse(r(w * 0.68, h * 0.25, 6, 2, "#9ff0ff"), 0, 1, 1600));
    return k;
  },
  // The Hunting Grounds: ruins in the jungle, and the Gehenna Bramble creeping through.
  6: (w, h) => {
    const k = [];
    [[0.05, 0.4], [0.3, 0.55], [0.55, 0.35], [0.8, 0.5]].forEach(([fx, fh]) => k.push(r(fx * w, h * (1 - fh), w * 0.12, h * fh, "#1a2a1a")));
    [[0.08, 3400], [0.22, 4300], [0.4, 3000], [0.58, 4700], [0.74, 3600], [0.9, 4100]].forEach(([fx, per], i) => {
      k.push(div().absolute().left(Math.round(fx * w)).top(0).w(3).h(8).bg(i % 2 ? "#3a8a2a" : "#7fd150").loop("height", { from: 6, to: Math.round(h * (0.55 + (i % 3) * 0.12)), period: per }));
      k.push(dot(fx * w - 1, h * (0.2 + (i % 3) * 0.2), 3, "#d63a3a"));
    });
    return k;
  },
  // The Great Race: glass tubes, racers, a countdown, the sponsors' number seven.
  7: (w, h) => {
    const k = [];
    [[0.18, 2200, "#5de0ff"], [0.44, 3000, "#ff5fae"], [0.7, 2600, "#f2c230"]].forEach(([fy, per, c]) => {
      const y = fy * h;
      k.push(r(0, y, w, 12, "#0c1a26").border_1().border_color("#24415a"));
      k.push(slide(r(0, y + 4, 10, 4, c).rounded_full(), 2, w - 34, per));
    });
    k.push(div().absolute().left(w - 30).top(4).text_size(11).font_semibold().text_color("#5de0ff").frames(["3", "2", "1", "GO"], 900));
    k.push(div().absolute().left(w - 22).top(h - 20).text_size(14).font_semibold().text_color("#ffffff33").child("7"));
    return k;
  },
  // Ghosts of Earth: a pastel copy of Havana, with memory ghosts walking through it.
  8: (w, h) => {
    const k = [];
    [["#7ad0c8", 0.0, 0.42], ["#e8b0a0", 0.14, 0.58], ["#e8d890", 0.28, 0.36], ["#a0c0e0", 0.44, 0.5], ["#e8a0b8", 0.6, 0.4], ["#8ad0a0", 0.74, 0.6], ["#e8c890", 0.88, 0.34]]
      .forEach(([c, fx, fh]) => k.push(r(fx * w, h * (1 - fh), w * 0.13, h * fh, c + "44")));
    [[0.1, 5200], [0.3, 4300], [0.55, 6100]].forEach(([fx, per], i) => {
      const g = div().absolute().top(h * 0.55).left(0).w(8).h(18).rounded_full().bg("#e4f3ef");
      k.push(pulse(slide(g, w * fx, w * (fx + 0.3), per), 0.15, 0.6, per / 2));
    });
    return k;
  },
  // Faction Wars: a flooded funnel city, a waterfall, and the water that won't stay down.
  9: (w, h) => {
    const k = [];
    [[0.1, 0.8], [0.18, 0.66], [0.26, 0.52], [0.34, 0.38]].forEach(([fx, fw], i) => k.push(r(w * fx, h * (0.1 + i * 0.16), w * fw, h * 0.15, "#6a5434")));
    k.push(pulse(r(w * 0.5, 0, 4, h * 0.6, "#9fd0f0"), 0.3, 0.9, 900));
    k.push(div().absolute().left(0).top(h * 0.66).w(w).h(h * 0.34).bg("#2a6a8a99").loop("height", { from: Math.round(h * 0.22), to: Math.round(h * 0.42), period: 3600 }));
    k.push(r(0, h - 6, w, 6, "#4a3a20"));
    return k;
  },
  // Don't Come in Last: seven heats leave the garage; a red zone creeps up on the back of the field.
  10: (w, h) => {
    const k = [r(0, 0, w * 0.12, h, "#1c1c20")];
    for (let i = 0; i < Math.ceil(h / 8); i++) k.push(r(0, i * 8, w * 0.12, 4, i % 2 ? "#ffb000" : "#1c1c20"));
    k.push(r(w * 0.12 - 1, 0, 1, h, "#ffb000"));
    const gap = h / 8;
    ["#ffb000", "#ff5a36", "#5de0ff", "#ff5fae", "#7fd150", "#c9a0ff", "#f2f2f2"].forEach((c, i) => {
      const y = Math.round(gap * (i + 1));
      k.push(r(w * 0.12, y, w * 0.88, 1, "#3a3a40"));
      k.push(slide(r(0, y - 3, 9, 6, c).rounded(2), w * 0.14, w * 0.9, 2400 + i * 420));
    });
    k.push(div().absolute().left(Math.round(w * 0.12)).top(0).w(4).h(h).bg("#ff2a2a55").loop("width", { from: 4, to: Math.round(w * 0.45), period: 5200 }));
    return k;
  },
  // Parade of Horribles: floats, bunting, confetti and a towering tree.
  11: (w, h) => {
    const k = [];
    const col = ["#ff4fd8", "#ffd24a", "#5de0ff", "#7fd150"];
    for (let i = 0; i < 12; i++) k.push(r(8 + (i * (w - 16)) / 12, 2 + (i % 2) * 3, 8, 8, col[i % 4]));
    k.push(r(w * 0.86, h * 0.34, 8, h * 0.66, "#3a2a1a"), r(w * 0.76, h * 0.08, w * 0.24, h * 0.32, "#2a6a3a").rounded(10));
    [[0.5, "#ff4fd8", 5200], [0.7, "#ffd24a", 6400], [0.3, "#5de0ff", 4600]].forEach(([fy, c, per], i) => {
      const f = div().absolute().top(Math.round(fy * h)).left(-36).w(34).h(22).rounded(3).bg(c)
        .child(r(4, 4, 8, 8, "#ffffffaa")).child(r(18, 4, 12, 4, "#00000044")).child(dot(5, 17, 8, "#1a1020")).child(dot(22, 17, 8, "#1a1020"));
      k.push(slide(f, -36, w * 0.74, per + i * 700));
    });
    for (let i = 0; i < 8; i++)
      k.push(div().absolute().left(Math.round(w * (0.05 + i * 0.12))).top(0).w(3).h(3).bg(col[i % 4]).loop("top", { from: 0, to: Math.round(h - 4), period: 2600 + i * 430, easing: "linear" }));
    k.push(div().absolute().left(8).top(Math.round(h - 14)).text_size(9).font_semibold().text_color("#ffd24a").child("T-3:15"));
    return k;
  },
};

// A scene for floor n, w by h pixels.
export function scene(n, w, h) {
  const make = SCENES[n] ?? SCENES[1];
  return div().relative().flex_none().w(w).h(h).overflow_hidden().bg(BG[n - 1] ?? BG[0]).children(make(w, h));
}
