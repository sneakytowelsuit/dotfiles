// Claude Code's AskUserQuestion, read off the screen so the inbox can draw it as a real form.
// Shapes seen (Claude Code 2.1):
//   single      ☐ Header / question / "❯ 1. Red" + indented description / last row "Type something." / "Enter to select ..."
//   multi       "←  ☐ Toppings  ✔ Submit  →" / "1. [ ] Cheese" ... last row "[ ] Type something" / "Submit" row
//   many        a tab bar, one ☐ (open) or ☒ (answered) per question
//   preview     options on the left, a ┌ box with the highlighted option's preview on the right, "Notes: ..." under it
//   review      "Review your answers" / "● question" "→ answer" / "1. Submit answers" "2. Cancel"
// A single select marks an earlier answer "2. Blue ✔". Typing into the "Type something" row shows
// "-- INSERT --" in the footer, and in a multi select ticks that row on its own.

const SEP = /^\s*[─━]{20,}\s*$/;
const OPT = /^\s*(?:❯\s*)?(\d+)\.\s+(?:\[([ ✔xX])\]\s+)?(.*?)\s*$/;

function parseClaudeForm(text) {
  const lines = String(text).split("\n").map((l) => l.replace(/\s+$/, ""));
  let f = -1;
  for (let i = lines.length - 1; i >= 0; i--) if (/Enter to select|Esc to cancel/.test(lines[i])) { f = i; break; }
  const hasFooter = f >= 0;
  if (!hasFooter) { f = lines.length; while (f > 0 && !lines[f - 1].trim()) f--; } // the review screen has no footer
  const inserting = hasFooter && /-- INSERT --/.test(lines[f]);
  // The last "1." above the footer starts the options; the separator above it opens the form.
  let o1 = -1;
  for (let i = f - 1; i >= 0; i--) { const m = OPT.exec(lines[i]); if (m && m[1] === "1") { o1 = i; break; } }
  if (o1 < 0) return null;
  let top = -1, end = f;
  for (let i = o1; i >= 0; i--) if (SEP.test(lines[i])) { top = i; break; }
  for (let i = o1; i < f; i++) if (SEP.test(lines[i])) { end = i; break; }
  let content = lines.slice(top + 1, end);
  if (!hasFooter && !content.some((l) => /Review your answers/.test(l))) return null;

  // Preview layout: split every row at the column where the box starts.
  const form = { step: "question", tabs: null, header: null, question: "", multi: false, options: [], answers: [], unanswered: false, cursor: null, inserting, preview: null, notes: null, notesPlaceholder: false };
  const boxLine = content.find((l) => l.includes("┌"));
  if (boxLine) {
    const c = boxLine.indexOf("┌");
    const body = [];
    let inBox = false;
    content = content.map((l) => {
      const right = l.length > c ? l.slice(c) : "";
      if (/^[┌│└]/.test(right) || /^Notes:/.test(right.trim())) {
        if (right.startsWith("┌")) inBox = true;
        else if (right.startsWith("└")) inBox = false;
        else if (inBox && right.startsWith("│")) body.push(right.replace(/^│\s?/, "").replace(/\s*│\s*$/, ""));
        else if (/^Notes:/.test(right.trim())) {
          const v = right.trim().replace(/^Notes:\s*/, "");
          form.notesPlaceholder = /^(press n|Add notes)/i.test(v);
          form.notes = form.notesPlaceholder ? "" : v;
        }
        return l.slice(0, c);
      }
      return l;
    });
    form.preview = body.join("\n");
  }

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
    if (/not answered all questions/.test(t)) { form.unanswered = true; continue; }
    if (form.step === "review") {
      let m = /^●\s+(.*)$/.exec(t);
      if (m) { form.answers.push({ q: m[1], a: "" }); continue; }
      m = /^→\s+(.*)$/.exec(t);
      if (m && form.answers.length) { form.answers[form.answers.length - 1].a = m[1]; continue; }
    }
    const m = OPT.exec(line);
    if (m) {
      if (m[2] !== undefined) form.multi = true;
      const marked = /\s+✔$/.test(m[3]);
      const label = m[3].replace(/\s+✔$/, "");
      if (/^\s*❯/.test(line)) form.cursor = Number(m[1]);
      form.options.push({ n: Number(m[1]), label, checked: marked || m[2] === "✔" || m[2] === "x" || m[2] === "X", desc: "", other: false });
      continue;
    }
    if (/^Submit$/.test(t) && form.options.length) continue; // a multi-select's own submit row
    if (/^Chat about this/.test(t)) continue;
    if (form.options.length) { const last = form.options[form.options.length - 1]; last.desc = (last.desc + " " + t).trim(); continue; }
    if (form.step !== "review" && !/Ready to submit/.test(t)) q.push(t);
  }
  form.question = q.join(" ");
  // Claude Code always adds "Type something" as the last row, except in a preview layout and on review.
  if (form.step === "question" && !form.preview && form.options.length) form.options[form.options.length - 1].other = true;
  return form.options.length ? form : null;
}

// Question forms per harness. To support another harness's question or approval prompt, write a function
// (screenText) => Form | null (the Form shape is documented in HARNESSES.md) and register it under the `app` name
// Herdr reports for that harness. With an `app` that has no parser the inbox shows the raw screen and quick replies,
// which always works. Without an `app` the Claude Code parser is used (older callers).
export const FORM_PARSERS = { "claude-code": parseClaudeForm };

export function parseForm(text, app) {
  if (!app) return parseClaudeForm(text);
  const p = FORM_PARSERS[app];
  return p ? p(text) : null;
}

// What `hc keys` can type: it has no names for ! ? ( ) : _ " @ # $ % ^ & * ~ | { } < > + and shifted symbols.
const KEY = { " ": "space" };
const PLAIN = new Set([..."abcdefghijklmnopqrstuvwxyz0123456789,.'-=/\;[]`"]);
export function keyFor(ch) {
  if (KEY[ch]) return KEY[ch];
  if (PLAIN.has(ch)) return ch;
  if (/^[A-Z]$/.test(ch)) return `shift+${ch.toLowerCase()}`;
  return null;
}
export const canType = (text) => [...text].every((c) => keyFor(c) !== null);
export const keysFor = (text) => [...text].map(keyFor);
