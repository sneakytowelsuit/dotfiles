# Plugging a coding-agent harness into Conduct

This document is for **an AI agent (or a person) who has been asked to make a coding-agent harness work well with the Conduct Herdr layout**: Codex, Gemini CLI, Aider, OpenCode, Cursor CLI, a home-grown agent, anything that runs in a terminal. It assumes **no other context**. Everything you need is here or in the files it points to.

Conduct is a Herdr layout (`layouts/conduct.json` plus the mods in `mods/conduct-*`). It shows every agent running under Herdr, decides which ones need a human, and gives the human an inbox, question forms, reply and nudge tools, snooze, a feed, an agent map, a jump palette, batch replies, usage/cost bars and recovery actions. Some of that works for any program that reports a status; some of it has to be taught how one particular harness looks and behaves. This file says exactly which is which, and how to teach it.

> **If you installed this layout for someone** (from the Herdr gallery or a folder on GitHub), finish by reading [Offer to integrate the user's harness](#offer-to-integrate-the-users-harness) and doing what it says.

---

## 1. Who does what

- **Herdr** (the desktop app, command `herdr-app`) draws the window from files in its home (`~/.config/herdr-app`, or `$HERDR_APP_HOME`). Mods are JavaScript files there.
- **herdr-core** (`hc`) runs every terminal and agent and keeps them alive. `hc ls --json`, `hc read <t>`, `hc send <t> <text>`, `hc keys <t> <keys...>`, `hc interrupt <t>`, `hc run [--bg] [--name N] [--cwd D] [--parent P] <argv...>`, `hc get <t> --json`, `hc kill <t>`.
- **A harness** is the program inside a terminal (Claude Code, Codex, ...). Conduct never talks to a harness's API. It only:
  1. reads what Herdr already knows about each terminal (`terminals()` in a mod, `hc ls --json` in a shell): its **status**, its **parent**, its **title**;
  2. reads its **screen** with `hc read`;
  3. **types into it** with `hc send` (text plus Enter) and `hc keys` (named key presses);
  4. reads its **session logs on disk** (for token usage), where it knows the format.

So "supporting a harness" means: make sure (1) is true, then teach the screen-reading and key-pressing parts (2 to 4) where the harness differs.

Repository layout (all under `herdr-conduct/`): `layouts/conduct.json`, `mods/conduct-<name>/` (runnable mods have `mod.json` and `main.js`), `keys.json`, `sync-shared.sh`, `test/`, `themes/`, `docs/integration/`, `RECIPE.md` (what the layout looks like and does), `README.md`.

**Mods cannot import across folders.** Shared modules (`attn.js`, `keys.js`, `recent.js`, `glyphs.js`, ...) have one source copy and are copied by `./sync-shared.sh`. Edit the source, run the script, then install. Never edit a copy.

---

## 2. Support tiers

Each tier works on its own. A harness at Tier 1 already gets a good experience.

| Tier | What it gives | What the harness needs |
|---|---|---|
| **1. Status** | Bar chips, sidebar cards, NEEDS YOU, tabs, pane headers, inbox cards with the agent's screen tail and quick replies, nudge, feed, alerts, snooze, agent map, jump palette, batch reply, stuck detection, sub-agent tree | Herdr must show the harness as an *agent*: `status` is one of `idle`, `working`, `done`, `blocked`, `error` (section 3). Sub-agents started with `hc run --parent` appear under their parent. |
| **2. Activity** | The live `Verb… 12s · 1.2k tokens` line on working agents; better stuck detection | The registry activity adapter (section 5). |
| **3. Questions** | The inbox draws the harness's question or approval prompt as a clickable form instead of a raw screen | The registry prompt classifier and key adapter (section 6). |
| **4. Usage** | Context-window bar, prompt-cache timer, cost estimate, burn rate, Usage dialog | A reader for the harness's session logs (section 7). |
| **5. Recovery** | "Restart and resume" for stuck or errored agents | The harness's resume command line (section 8). |

### Support today (verified 2026-11 against Claude Code 2.1 and codex-cli 0.167.1)

| Harness (`status.app`) | 1 Status | 2 Activity | 3 Questions | 4 Usage | 5 Recovery |
|---|---|---|---|---|---|
| Claude Code (`claude-code`) | yes (Herdr installs a session hook) | yes | yes (AskUserQuestion) | yes | yes (`--continue`) |
| Codex (`codex`) | yes (reports itself; states seen: idle, working, done, blocked) | yes (`• Working (12s • esc to interrupt)`) | command approvals (select a choice, then confirm) | context and cache hits for a local TUI with an open rollout (section 7) | yes for plain interactive launches (`codex resume --last`, see section 8) |
| anything else | check with section 3 | no | no | no | no |

Everything not marked "yes" falls back safely: the raw screen, quick replies, nudge, and every harness-agnostic feature still work.

---

## 3. Tier 1: status (what Herdr must report)

Herdr decides what is an agent from a **status report** the program makes. Conduct reads it from `terminals()`: each entry has `address`, `parent`, `title`, `name`, `cwd`, `foreground.{argv,cwd}`, `labels`, `status` (a string, or an object `{state, app, msg, kind}`), `report` (the object form), `state` ("live").

The report is an OSC 7501 escape sequence printed to the terminal. Observed format (see `test/fake-agent.sh`, which is a working simulator):

```
ESC ] 7501 ; 1:state=<state>:app=<app>[:msg=<text>][:kind=<kind>] BEL
```

| Field | Values | Meaning |
|---|---|---|
| `state` | `idle`, `working`, `done`, `blocked`, `error` | `working`: busy on a turn. `blocked`: **waiting for a person** (a question, a permission, a login); set `kind`. `done`: finished a turn while nobody was looking (Herdr turns it into `idle` once someone looks). `error`: failed. `idle`: waiting for the next instruction. |
| `app` | a stable lower-case id, e.g. `claude-code`, `codex` | **This is the key every table in Conduct is indexed by.** Pick it once and keep it. |
| `kind` (only with `blocked`) | `permission`, `question`, `auth` | what it is waiting for |
| `msg` | short text, no colons | shown on the inbox card and the feed |

Titles come from the usual terminal title escape (`ESC ] 0 ; title BEL`). Names come from `hc run --name`.

**How Herdr learns it:**
- Claude Code: Herdr installs `~/.claude/hooks/herdr-agent-state.sh` and a `SessionStart` hook in `~/.claude/settings.json` (marked `HERDR_INTEGRATION_ID=claude`). Do not edit it (reinstalling overwrites it); add your own hooks beside it.
- Codex: observed reporting `status = {'app': 'codex', 'state': 'working'}` with no setup done by this layout. Whether that comes from an integration Herdr installed or from Codex itself was not determined; on a new machine, run the check below instead of assuming.
- A new harness: use the harness's lifecycle hooks or notification command to print the sequence above to its terminal (`printf '\033]7501;1:state=blocked:app=myagent:kind=question\007' > /dev/tty`), on: turn start (`working`), turn end (`done` or `idle`), a question or permission prompt appearing (`blocked`), an error (`error`). Herdr's own docs (`~/.config/herdr-app/AGENTS.md`, "Agents are terminals whose program reports a status") and `hc --skill` describe the same mechanism.

**Check it:**
```sh
hc run --bg --no-parent --name probe <harness command>      # starts it as a Herdr terminal
hc get probe --json | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['status'], d['reported'])"
hc send probe "say hi" --force      # then poll `hc get probe --json` until the state moves: working -> done/idle
hc kill probe
```
`reported` must be true and `status.app` must be your id. If `status` stays null, Herdr cannot see it as an agent and nothing else in Conduct will show it.

**Sub-agents** (workers a primary starts) must be started with `hc run --bg --parent <primary terminal> ...` (the default parent is the terminal `hc` runs in, so a harness that shells out to `hc run` from inside its own terminal gets this for free). `terminals()` then gives each worker a `parent`, and Conduct draws the tree. Note that `agents()` (the other function in the `herdr` module) omits sub-agents; Conduct always uses `terminals()`.

---

## 4. How a feature learns about your harness (the contract)

Conduct's model (`mods/conduct-bar/attn.js` `model()`) turns each terminal into a node. The fields you can rely on: `address, parent, children[], app, appName, title, name, status` (effective: `blocked, error, stalled, done, working, idle`), `raw` (Herdr's status), `msg, kind, space, spaceName, tab, tabName, pane, focused, since, unseen, fresh, snoozed, primary`. `n.app` is the harness id from section 3. Every harness-specific behaviour below is looked up by `n.app`.

The canonical lookup is `HARNESS_REGISTRY` in `mods/conduct-harnesses/harnesses.js`:

| Required capability | Adapter contract |
|---|---|
| `identity` | `name` and `icon` |
| `status` | `supports.herdrReports` records whether Herdr receives status from the harness |
| `activity` | `match(line)` returns a verb and stats, and `stableStats(stats)` removes the clock |
| `prompt` | `classify(screen, agent)` identifies a form, a text composer, or an unknown prompt. `choiceKeys(screen, form, number)` verifies a choice against the live screen. `actionKeys(form, action, number)` describes other form actions. Declare support for approvals and structured questions. |
| `usage` | `read(context)` returns metrics using the injected local runtime. Declare support for context, cache hits, cache expiry, and cost. |
| `recovery` | `matches(argv)` identifies older sessions without an app report, and `resumeArgs(argv)` returns the argv insertion or `null`. |

Every registered adapter declares each capability. A false support flag records a verified gap. Return `null` or an unknown classification when the terminal does not expose the data or protocol needed for a particular operation. An unregistered harness still gets layout features backed by Herdr status.

`validateHarnesses()` reports missing methods and support declarations by path. The registry tests require examples for each shipped harness. The Conduct GitHub Actions workflow runs the tests and fails when `sync-shared.sh` would change tracked copies or create missing ones. Run `./sync-shared.sh` and `node --test test/**/*.test.mjs` from this folder before committing.

---

## 5. Tier 2: the activity line

The activity adapter supplies `match(line)` and `stableStats(stats)`. Conduct shows the live verb and stats in the sidebar and uses stable text to detect stalls. The registry's helper accepts a pattern with the verb in capture group 1 and the optional stats in group 2. Keep stats that change as work happens, such as token counts.

**How to learn the line** (costs a few cents): start the harness under `hc run --bg`, send it a task that takes a few seconds (`hc send`), and `hc read <t>` repeatedly while `hc get <t> --json` says `working`. Copy the line verbatim into a test.
**Tests:** `test/harness/activity.test.mjs` (add cases; run with `node test/harness/activity.test.mjs`). The elapsed time must not change the signature; the token count should.
**Sync/install:** `activity.js` is only used by `conduct-queue`; copy `mods/conduct-queue/` into the Herdr home.

---

### Harness mark

Set the registry identity's icon filename and add the SVG under `mods/conduct-glyphs/`. Use a 24×24 viewBox and `stroke="currentColor"`. Unregistered harnesses use the generic robot.

## 6. Tier 3: questions and approval prompts

When an agent is `blocked`, the inbox shows its screen. If a parser recognises the screen, it shows a **form** instead, and answers by pressing the keys the harness expects.

### The Form shape (what a parser returns, or `null`)

```js
{
  step: "question" | "review",     // "review": a final "submit your answers" screen
  tabs: null | [{ done: bool, label: string }],   // a multi-question form's tab strip
  header: string | null,           // short title of a single-question form
  question: string,                // the question text (one line, joined)
  multi: bool,                     // checkboxes (many answers) vs radio (one)
  options: [{ n: number,           // the number the harness shows (1-based)
              label: string, desc: string,
              checked: bool,       // currently selected/ticked
              other: bool }],      // the free-text "Something else" row
  answers: [{ q: string, a: string }],  // review step only
  unanswered: bool,                // review step only: some questions left unanswered
  cursor: number | null,           // which option the harness's cursor is on
  inserting: bool,                 // a free-text field has the keyboard
  preview: string | null,          // text beside the options for the highlighted one
  notes: string | null, notesPlaceholder: bool
}
```
Single-select, multi-select, many questions, a review step, free-text "other" and previews are all expressible. A plain "Allow this command? 1. Yes 2. Yes, always 3. No" prompt is a single-select form with three options and no tabs. Return only the fields that apply; the rest take the defaults above. See `parseClaudeForm` in `mods/conduct-harnesses/prompts.js` for an example.

### Classify prompts and describe their keys

The inbox and batch reply use the same classifier. Return `{ kind: "form", form }` when the active screen matches, `{ kind: "text" }` for a verified text composer, or `{ kind: "unknown" }` when Conduct should show the raw screen and offer a terminal jump. Batch replies apply only to text prompts.

The adapter returns key names. Conduct owns confirmation, reads the current screen before applying a choice that requires confirmation, and sends the keys with `hc keys`. Claude Code's adapter also describes navigation, custom answers and preview notes. Codex approval choices use their number after confirmation.

`hc keys` cannot produce `! ? ( ) : _ " @ # $ % ^ & * ~ | { } < > +`; text with those characters is pasted with `hc send` instead (which also presses Enter and tags the text `<hc from=…>`).

**How to learn a harness's prompts** (do this with the cheapest model/session you can): start it under `hc run --bg`, make it hit each prompt type (a command needing approval; a question; a login), and for each `hc read <t>` the screen and **save it verbatim as a fixture** in `test/harness/`. Then try the keys with `hc keys <t> <key>` and read the screen after each, recording what each key does. **Do not guess key semantics.** Build the classifier and key adapter against those fixtures and add tests under `test/harness/`.
**Answering approval prompts is answering on the user's behalf.** Conduct never answers one without a person clicking or pressing a key. Keep it that way: no auto-approve, no batching of approvals without the confirm step `conduct-batch` already requires.

Quick replies use `hc send --force` for text prompts. Keep menus and unrecognized blocked screens out of that path.

---

## 7. Tier 4: usage and cost (token numbers from session logs)

Files: `mods/conduct-usage/usage-poll.js` (finds and reads the logs), `usage.js` (pure maths: context window, cache, cost, burn; `WINDOW_*`, `PRICES`), `health.js` (bars), plus the consumers (`conduct-queue`, `conduct-pane`, `conduct-bar`, the `conduct-usage` dialog).

**Adapter contract.** For each local agent of your harness, return the same record the Claude reader returns: per model turn, `{ t (ms), model, input, output, cacheRead, cacheCreate5m, cacheCreate1h }`, newest last; `usage.js` turns those into the metrics shown. Read **only token counts, model names and timestamps. Never read, copy or store conversation text.** Read only the tail of the log (logs are large), and only for agents on this machine.

**Where Claude Code's are:** `~/.claude/projects/<cwd with every non-alphanumeric character replaced by "-">/*.jsonl`, newest file; per assistant line `message.usage.{input_tokens, output_tokens, cache_read_input_tokens, cache_creation_input_tokens, cache_creation.{ephemeral_5m_input_tokens, ephemeral_1h_input_tokens}}`, `message.model`, top-level `timestamp`. The folder is the **agent process's** working directory (`terminals()[i].foreground.cwd`), not the folder the shell started in.

**Where Codex usage comes from (CLI 0.167.1).** `hc get <terminal> --json` supplies the live foreground PID. On Linux, Conduct resolves that process's open `sessions/.../rollout-*.jsonl` through `/proc/<pid>/fd`. This works with custom Codex homes and distinguishes sessions in the same directory. With no visible rollout or multiple distinct open rollouts, the row stays empty. A daemon that owns the rollout separately needs its own session lookup.

The reader tails up to 2 MB and uses `jq` to emit the model from `turn_context` and numeric fields from `event_msg/token_count`. It uses `last_token_usage.input_tokens` for context usage, `model_context_window` for capacity, and the cached share of input for the cache bar. The cumulative token count identifies duplicate snapshots. Codex reports cache hits in these events. Conduct shows the recent ratios and leaves expiry and billing fields empty.

For a harness that reports cache hits without an expiry, use the measured cache ratio and leave the TTL empty. Supply cost only when the harness has a suitable price mapping. The dated Claude Code estimates are in `PRICES`.

---

## 8. Tier 5: restart and resume

File: `mods/conduct-recover/recover.js` (`canResume`, `withContinue`) and `recover-actions.js` (`restart`). "Restart" kills the terminal and runs it again with the same argv, folder, name and parent; "restart and resume" for Claude Code inserts `--continue` so it picks up the latest conversation in that folder. For another harness, implement `recovery.resumeArgs(argv)` (an extra flag, or a subcommand such as `<program> resume --last`; **verify it exists and does what you think in a scratch folder before offering it**), keyed by `app`/argv[0]. Restarting loses the conversation unless the harness resumes by itself: the UI says so, keep it saying so.

For Codex, Conduct offers **Restart and resume** for plain interactive launches, including `--no-alt-screen` and `--no-daemon`. It runs `codex resume --last` in the original working directory with those flags preserved. If several sessions ran in that directory, Codex may select a different session. Commands with an initial prompt, other options, or a subcommand use the regular Restart action. See the [Codex CLI reference](https://learn.chatgpt.com/docs/developer-commands?surface=cli).

---

## 9. Everything that needs no work

Nudge (the message to a primary lists flagged sub-agents and tells it to use `hc ls`, `hc read`, `hc send`, `hc interrupt`: the receiving harness must be able to run shell commands), feed and alerts, snooze, agent map, jump palette, batch reply for text replies, settings, themes, hotkeys, stuck detection (it hashes the screen, ignoring the activity line's clock; add your harness's ticking text to the registry in section 5 if the screen changes every second for no reason).

---

## 10. Procedure: adding a harness

Do these in order. Stop and report at any step you cannot complete; partial support is fine (section 2).

1. **Preflight.** `herdr-app --version`, `hc --version`; find the Herdr home (`$HERDR_APP_HOME` or `~/.config/herdr-app`); confirm `layouts/conduct.json` and `mods/conduct-*` are installed there (if not, install the layout first: README); `herdr-app status` shows no errors.
2. **Tier 1.** Run the check in section 3. If the harness is not seen as an agent, stop here and fix reporting first.
3. **Probe the harness** with a throwaway session in a scratch folder (`hc run --bg --no-parent --name probe --cwd /tmp/probe ...`). Use the cheapest model. Record, as fixtures in `test/harness/<app>/`: the working line, the blocked screens (one per prompt type), the finished screen. Note the exact `status` transitions you saw. Kill the probe (`hc kill probe`).
4. **Write the profile** (section 12) from what you measured, not what you expect.
5. **Make the edits**, register its identity and status, then implement activity, prompts, usage and recovery. Tests for each (`node test/harness/*.test.mjs`; pure modules have no `herdr` imports).
6. **`./sync-shared.sh`**, then **ask the user before changing their machine** (section 11), then install only the changed mods and run `herdr-app check` on each.
7. **Verify live**, without spending tokens where you can: `test/scenario.sh up 12` starts fake agents (they report `app=claude-code`; copy `test/fake-agent.sh` and change the `app=` to simulate yours, and make it print your harness's working line). Check the conformance list (section 13). Then one real, tiny session of the harness to confirm the screens match your fixtures.
8. **Document** the support in the table in section 2 and add the profile; keep fixtures and tests; open a pull request upstream (the repo is the source of truth).

---

## 11. Changing the user's machine: consent and safety

The user installs this layout into their Herdr home; the changes in section 10 step 6 modify files **there**, not just in the repo. Before touching anything there:

1. Say, in plain words, **which files** you will change (absolute paths), **what each change does**, and that nothing is sent anywhere.
2. Offer what you will do **in the order you will do it**, and ask for an explicit yes. A yes to "add Codex support" is not a yes to unrelated edits.
3. Back up each file you will overwrite to a folder **outside** the Herdr home (`~/.config/herdr-app-backups/<date>/...`); Herdr loads some files it finds inside its home.
4. Never edit the user's `keys.json`, `settings.json`, `shared.json`, or other layouts as part of this. (The settings mod edits `keys.json` and `settings.json` itself, on request.)
5. After installing, run `herdr-app check` on every mod you touched and `herdr-app status`; if either fails, restore from the backup and tell the user.
6. Tell them how to undo it: restore the backup folder, or re-copy the mods from the repo.

---

## Offer to integrate the user's harness

If you have just **installed this layout** for someone (from the gallery's recipe or by copying the folder):

1. Find which harnesses they run. Look at `hc ls --json` (`agent` and `status.app` per terminal) and at what is installed (`which claude codex gemini aider opencode`).
2. Compare with the table in section 2.
   - All of them at the tiers you need: say so and finish.
   - Some harness missing or partial: **tell the user what they would get with it integrated** (for instance: "Codex agents already appear and can be answered with quick replies; I can also add their live activity line, clickable approval forms and usage bars"), and **ask whether you should do it now** following section 10, with the consent steps in section 11. Do not start without a yes. If they decline, leave the layout as installed: it works without it.

---

## 12. Harness profile (fill this in; keep it in the pull request)

```
Harness:            name and version tested
status.app:         the id it reports
Tier 1:             how it reports (built into Herdr / hook you added), states seen: idle? working? done? blocked? error?
Blocked kinds:      which prompts exist (permission / question / auth) and what each screen looks like (fixture names)
Activity line:      the regex, and an example line
Question forms:     parser name; which prompt types it handles; the key protocol (what each key does, verified how)
Typed answers:      typed as keys or pasted? any characters that cannot be typed?
Usage logs:         path pattern, file format, the fields used, how a log is matched to a terminal
Resume:             command line, verified how, caveats
Known gaps:         what still falls back to the raw screen
Cost to test:       what the probing sessions cost
```

### Codex CLI 0.167.1

- Herdr lists Codex as `codex`. The existing activity parser reads lines such as `• Working (12s • esc to interrupt)`.
- Recovery uses `codex resume --last`. Argument construction is covered by the attention tests. A scratch CLI launch entered the resume flow and reached sign-in before a session could be restored.
- Command approvals report `blocked` with kind `permission`. The inbox draws the captured menu as a form and sends the selected number after confirmation. The scratch Herdr test exercised proceed and deny. See `test/harness/codex/command-approval.txt`.
- Other Codex prompts use the raw screen. The Default-mode scratch session could produce command approvals but could not open a structured question.
- Usage is matched by the foreground process's open rollout. The context window and cache-hit share come from the log.


## 13. Conformance checklist

After integrating, each of these should be observable (use fake or tiny real sessions):

1. The agent appears in the bar counts and the sidebar within one poll (4 s), under its parent if it has one.
2. While it works, its sidebar row shows `Verb… stats` (Tier 2).
3. When it blocks, it appears under NEEDS YOU with a filled halo and counts in `INBOX n`; the inbox card shows its question (a form for Tier 3, otherwise the screen tail with quick replies); answering unblocks it and the card advances.
4. Its "finished" after your answer does not appear as unread in the Finished list.
5. Left alone with an unchanged screen for the stall limit (`conduct.stall_ms`, default 3 minutes), it shows STUCK?; moving the screen clears it.
6. The Usage dialog and the pane header show its context and measured cache stats when its usage log is available. Costs and expiry appear when the harness adapter can supply them.
7. `herdr-app check` passes for every mod; `node test/**/*.test.mjs` pass; nothing in the repo or the fixtures contains conversation text, tokens or personal paths.

## 14. Pitfalls (each one has cost someone an hour)

- **`agents()` omits sub-agents**; use `terminals()`. A sub-agent's `status` is an object; its `status_ms` is null; its space and tab come from its parent's labels.
- **A click handler's `cx` is valid only until its first `await`.** Use the AsyncContext that `init(_p, cx)` receives for timers, `notify()` and anything after an await.
- **`hc send` presses Enter and tags the text** with `<hc from=…>`; `hc keys` never submits. Use keys for menus, `send` for text boxes.
- **`hc send` refuses a blocked agent unless `--force`**: that is on purpose; Conduct uses it only on a person's click or key.
- **`ScrollHandle.new()`**, not `new ScrollHandle()`. **Scroll containers grow**: give a header row a fixed height.
- **Light themes only show in light appearance.** **px sizes are design sizes that scale with zoom**; measured widths are real window pixels.
- **Never read conversation text** from session logs or screens beyond what the feature needs (the last screen lines for the inbox card are the exception, shown only to the person at that machine).
- Codex's sandbox (`codex exec -s workspace-write`) cannot run `herdr-app check` (it needs the display): run the check outside it.

### Lessons from the Codex integration

- **Probe the feature in the mode that exposes it.** A fresh temporary harness home can stop at sign-in. A question tool may be available only in a specific interaction mode. Use a named scratch terminal and directory, confirm the harness and mode, and exercise one harmless prompt per feature.
- **Capture the screen and the status together.** Save only the active menu, strip personal paths and unrelated conversation, and record `status.app`, `state`, and `kind`. Preserve the prompt header, command, numbered options, cursor, wrapping, and footer so fixtures reflect what `hc read` returns.
- **Measure what each key does.** Some harnesses submit as soon as you press a digit. Codex does this for command approvals even though the footer mentions Enter. In Conduct, stage the selection, re-read the active prompt, and forward a single key only after confirmation. Test proceed and deny on harmless commands, and distinguish a persistent permission choice in the fixture.
- **Identify the live session before reading metrics.** A shell's cwd can differ from its foreground process's cwd. Several agents can share either cwd, and a resumed session can have an older file. Prefer a session ID or an exact process-to-file association. Check whether a daemon owns the log, and leave metrics empty when the identity is ambiguous.
- **Check the counter semantics.** Some events repeat snapshots or report cumulative and per-request counts together. Cached tokens can already be included in input. Use a reported per-session window when available, and use an observed cache-hit share when the log carries no expiry information.
- **Verify both copies of shared code.** Run `sync-shared.sh`, test the pure adapters, then run `herdr-app check` for each affected mod with access to the desktop compositor. The check can generate `gpui-kit.d.ts` and `jsconfig.json`; keep generated files out of the patch unless the repo already tracks them. A mod check validates loading. A live Conduct inbox test also needs the changed mods loaded in the active Herdr home.
