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
  let endOfScreen = lines.length;
  while (endOfScreen > 0 && !lines[endOfScreen - 1].trim()) endOfScreen--;
  const last = lines[endOfScreen - 1] ?? "";
  const hasFooter = /Enter to select|Esc to cancel/.test(last);
  // The review screen has no footer. It ends with its Cancel option.
  const lastOption = SEP.test(last) ? lines[endOfScreen - 2] ?? "" : last;
  if (!hasFooter && !/^\s*(?:❯\s*)?2\.\s+Cancel(?:\s+✔)?$/.test(lastOption)) return null;
  const f = hasFooter ? endOfScreen - 1 : endOfScreen;
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

const CODEX_APPROVAL = "Would you like to run the following command?";
const CODEX_FOOTER = "Press enter to confirm or esc to cancel";
const CODEX_OPTION = /^\s*(›\s*)?(\d)\.\s+(.+)$/;

function parseCodexApproval(text) {
  const lines = String(text).trimEnd().split("\n");
  if (lines.pop()?.trim() !== CODEX_FOOTER) return null;
  const top = lines.findLastIndex((line) => line.trim() === CODEX_APPROVAL);
  if (top < 0) return null;

  const body = [];
  const options = [];
  let cursor = null;
  for (const line of lines.slice(top + 1)) {
    if (!line.trim()) continue;
    const match = CODEX_OPTION.exec(line);
    if (!match && !options.length) { body.push(line.trimEnd()); continue; }
    if (!match && /^\s{3,}\S/.test(line)) {
      options[options.length - 1].label += " " + line.trim();
      continue;
    }
    if (!match || Number(match[2]) !== options.length + 1) return null;
    const n = Number(match[2]);
    if (match[1]) cursor = n;
    options.push({ n, label: match[3], checked: false, desc: "", other: false });
  }
  if (cursor == null || !body.some((line) => line.trimStart().startsWith("$ ")) ||
      options[0]?.label !== "Yes, proceed (y)" ||
      !/^No, .+ \(esc\)$/.test(options.at(-1)?.label ?? "") ||
      (options.length !== 2 && (options.length !== 3 || !/^Yes, .+ \(p\)$/.test(options[1].label)))) return null;

  return {
    step: "question", approval: true, header: "Command approval", question: body.join("\n"),
    options, cursor,
  };
}

const unknown = { kind: "unknown" };
const textPrompt = { kind: "text" };
const liveBlock = (agent, kind) => agent?.status === "blocked" && agent.kind === kind;

function classifyClaude(screen, agent) {
  if (liveBlock(agent, "question")) {
    const form = parseClaudeForm(screen);
    if (form) return { kind: "form", form };
  }
  // A bare prompt at the end of the screen identifies the text composer.
  if (agent && (agent.status !== "blocked" || agent.kind === "question") &&
      /^\s*❯$/.test(String(screen).trimEnd().split("\n").at(-1))) return textPrompt;
  return unknown;
}

function classifyCodex(screen, agent) {
  if (!liveBlock(agent, "permission")) return unknown;
  const form = parseCodexApproval(screen);
  return form ? { kind: "form", form } : unknown;
}

function sameChoices(current, shown) {
  return current && shown && current.question === shown.question &&
    current.options.length === shown.options.length &&
    current.options.every((option, i) => option.n === shown.options[i].n && option.label === shown.options[i].label);
}

function claudeActionKeys(form, action, number) {
  switch (action) {
    case "choice": {
      const option = form.options.find((item) => item.n === number);
      if (!option) return null;
      if (form.multi && option.other) {
        const distance = number - (form.cursor ?? 1);
        return Array(Math.abs(distance)).fill(distance > 0 ? "down" : "up");
      }
      return [String(number)];
    }
    case "reset": return number.map(String);
    case "finishOther": return [form.multi ? "up" : "enter"];
    case "finishPastedOther": return form.multi ? ["enter", "up"] : [];
    case "openNotes": return ["n"];
    case "closeNotes": return ["esc"];
    case "submitPreview": return ["enter"];
    case "advance": return form.inserting ? ["up", "right"] : ["right"];
    case "skip": return ["right"];
    case "back": return ["left"];
    case "jump": return [
      ...(form.inserting ? ["up"] : []),
      ...Array(form.tabs.length).fill("left"),
      ...Array(number).fill("right"),
    ];
    case "dismiss": return ["esc"];
    default: return null;
  }
}

export const claudePrompt = {
  supports: { approval: false, questions: true },
  classify: classifyClaude,
  parse: parseClaudeForm,
  choiceKeys(screen, shown, number) {
    const current = parseClaudeForm(screen);
    if (!sameChoices(current, shown) || current.step !== shown.step || current.multi !== shown.multi ||
        current.header !== shown.header || (current.preview == null) !== (shown.preview == null) ||
        JSON.stringify(current.tabs?.map((tab) => tab.label)) !== JSON.stringify(shown.tabs?.map((tab) => tab.label)) ||
        JSON.stringify(current.answers) !== JSON.stringify(shown.answers)) return null;
    return claudeActionKeys(current, "choice", number);
  },
  actionKeys: claudeActionKeys,
};

export const codexPrompt = {
  supports: { approval: true, questions: false },
  classify: classifyCodex,
  parse: parseCodexApproval,
  choiceKeys(screen, shown, number) {
    const current = parseCodexApproval(screen);
    return shown?.approval && sameChoices(current, shown) && current.options.some((option) => option.n === number)
      ? [String(number)] : null;
  },
  actionKeys(form, action) {
    return form.approval && action === "dismiss" ? ["esc"] : null;
  },
};
