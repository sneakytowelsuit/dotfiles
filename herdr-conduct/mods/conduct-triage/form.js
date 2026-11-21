// Claude Code's AskUserQuestion, read off the screen so the inbox can draw it as a real form.
// Seen shapes (Claude Code 2.1):
//   single      ☐ Header / question / "❯ 1. Red" + indented description / "3. Type something." / "Enter to select ..."
//   multi       "←  ☐ Toppings  ✔ Submit  →" / "1. [ ] Cheese" ... / "Submit" row
//   many        a tab bar with one ☐ (open) or ☒ (answered) per question; digits answer and move on
//   review      "Review your answers" / "● question" "→ answer" / "1. Submit answers" "2. Cancel"
// Keys that drive it: a digit selects (single) or toggles (multi); `right` leaves a multi-select for review; `1` submits.

const SEP = /^\s*[─━]{20,}\s*$/;
const OPT = /^\s*(?:❯\s*)?(\d+)\.\s+(?:\[([ ✔xX])\]\s+)?(.*?)\s*$/;

export function parseForm(text) {
  const lines = String(text).split("\n").map((l) => l.replace(/\s+$/, ""));
  let f = -1;
  for (let i = lines.length - 1; i >= 0; i--) if (/Esc to cancel/.test(lines[i])) { f = i; break; }
  const hasFooter = f >= 0;
  if (!hasFooter) { f = lines.length; while (f > 0 && !lines[f - 1].trim()) f--; } // the review screen has no footer
  // The last "1." above the footer starts the options; the separator above it opens the form.
  let o1 = -1;
  for (let i = f - 1; i >= 0; i--) { const m = OPT.exec(lines[i]); if (m && m[1] === "1") { o1 = i; break; } }
  if (o1 < 0) return null;
  let top = -1, end = f;
  for (let i = o1; i >= 0; i--) if (SEP.test(lines[i])) { top = i; break; }
  for (let i = o1; i < f; i++) if (SEP.test(lines[i])) { end = i; break; }
  const content = lines.slice(top + 1, end);
  if (!hasFooter && !content.some((l) => /Review your answers/.test(l))) return null;

  const form = { step: "question", tabs: null, header: null, question: "", multi: false, options: [], answers: [] };
  const q = [];
  for (const line of content) {
    const t = line.trim();
    if (!t) continue;
    if (/Submit/.test(t) && /[☐☒]/.test(t)) {
      form.tabs = [...t.matchAll(/([☐☒])\s+([^☐☒✔←→]+?)(?=\s{2,}|\s*[✔→]|$)/g)].map((m) => ({ done: m[1] === "☒", label: m[2].trim() }));
      continue;
    }
    if (/^[☐☒]\s+\S/.test(t) && !form.options.length) { form.header = t.replace(/^[☐☒]\s+/, ""); continue; }
    if (/Review your answers/.test(t)) { form.step = "review"; continue; }
    if (form.step === "review") {
      let m = /^●\s+(.*)$/.exec(t);
      if (m) { form.answers.push({ q: m[1], a: "" }); continue; }
      m = /^→\s+(.*)$/.exec(t);
      if (m && form.answers.length) { form.answers[form.answers.length - 1].a = m[1]; continue; }
    }
    const m = OPT.exec(line);
    if (m) {
      if (m[2] !== undefined) form.multi = true;
      form.options.push({ n: Number(m[1]), label: m[3], checked: m[2] === "✔" || m[2] === "x" || m[2] === "X", desc: "", other: /^Type something/i.test(m[3]) });
      continue;
    }
    if (/^Submit$/.test(t) && form.options.length) continue; // a multi-select's own submit row
    if (form.options.length) { const last = form.options[form.options.length - 1]; last.desc = (last.desc + " " + t).trim(); continue; }
    if (form.step !== "review" && !/Ready to submit/.test(t)) q.push(t);
  }
  form.question = q.join(" ");
  if (form.step === "review") form.options = form.options.map((o) => ({ ...o, label: o.label }));
  return form.options.length ? form : null;
}
