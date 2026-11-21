# Batch replies, Jump palette and Density

**Batch reply** (`ctrl-alt-b`) opens a 62% × 86% dialog on the theme's popover colour. The pinned header has a Close button. The scrolling body groups blocked agents into surface-coloured cards with 12px padding, a border and 8px gaps. Each card shows a representative waiting message, checked agents with their spaces, three quick replies, a three-line editable reply and a recipient preview. Quick replies fill the editor. The first click on “Send to N agents” arms the exact recipient list and text, and the second confirms them. Below the preview, permission-like prompts carry a warning in the blocked colour. Delivery is sequential and reported inline in the done or blocked colour. Successful recipients are removed from the send selection. Claude Code question forms are listed under “Answer these in the inbox”. Unreadable or unidentifiable prompts appear under “Prompt unavailable”.

**Jump palette** (`ctrl-alt-k`) opens a 50% × 78% dialog with its search field near the top of the window. It uses the popover background and a scrolling list of rows at least 38px tall. Each agent row shows a 7px dot using its state colour, a 12px semibold title, its space and tab in 11px muted text and the time in state in 11px dim text. The selection uses an accent outline and raised background. Matching covers the title, Herdr name, address, location and current reported message, plus space and tab destinations. The empty search starts with recent live agents, then agents needing attention, other agents and destinations. Up and Down move the selection, Enter jumps, and Esc closes. `ctrl-alt-tab` returns to the preceding live agent in the history of Conduct jumps, and repeated presses toggle between the two most recent live destinations.

**Density** adds a settings tab with Comfortable and Compact buttons. Comfortable is the default and preserves the current spacing. Compact reduces queue card padding from 10px × 7px to 8px × 4px, line padding from 8px × 4px to 6px × 2px, and most queue text by 1px. The shared spacing table also provides metrics for tabs and the inbox. The density folder's entry point is inert and has no layout slot or overlay.

## Shared-file integration

### Navigation and hotkeys

Copy `mods/conduct-jump/recent.js` into `mods/conduct-bar/`. Apply the changes shown by `diff -u mods/conduct-bar/attn.js mods/conduct-jump/attn.js` to the canonical `conduct-bar/attn.js` (preserving any changes from other tracks). Import the pure helpers and add the recording hook at the beginning of `go(n)`, then add the exported helper after `go`:

```js
import { previousAddress, recordRecent } from "./recent.js";

// At the start of go(n)
const recent = shared("conduct.recent");
if (recent?.[0] !== n.address) setShared("conduct.recent", recordRecent(recent, n.address));

// After go(n)
export function previous() {
  const { nodes } = model();
  const recent = shared("conduct.recent");
  const address = previousAddress(recent, nodes, recent?.[0]);
  if (address) go(nodes.get(address));
}
```

History tracks calls to `go()`. Direct pane focus or tab clicks do not enter it. A preceding destination is available after two distinct agents have been visited through `go()`. No model fields are required. The batch copy of `send()` already calls `noteAnswered` on success.

In `conduct-bar/main.js`, add `previous` to the `./attn.js` import and insert this immediately after the nudge branch of the `nextCommand` loop:

```js
if (c === "previous") { previous(); continue; }
```

Add these entries to the global section of `ACTIONS` in `conduct-bar/keys.js`:

```js
{ id: "g.batch", scope: "global", label: "Open batch reply", command: "mod.open:conduct-batch", def: ["ctrl-alt-b"] },
{ id: "g.jump", scope: "global", label: "Open jump palette", command: "mod.open:conduct-jump", def: ["ctrl-alt-k"] },
{ id: "g.previous", scope: "global", label: "Jump to previously visited agent", command: "conduct-bar.previous", def: ["ctrl-alt-tab"] },
```

Add these properties to `layout:conduct` in `keys.json` and merge that section into the live keymap at integration time:

```json
"ctrl-alt-b": "mod.open:conduct-batch",
"ctrl-alt-k": "mod.open:conduct-jump",
"ctrl-alt-tab": "conduct-bar.previous"
```

Opening shortcuts go through Herdr's keymap and the existing Settings bindings UI. The palette's editing/navigation keys are local to its focused search field.

### Module sync

Extend the existing `attn.js` recipient list in `sync-shared.sh` with `conduct-batch conduct-jump`. After the `attn.js` loop, insert the following. This gives every local copy of the updated `attn.js` its sibling dependency. Keep the existing `keys.js` sync loop.

```sh
for m in conduct-queue conduct-pane conduct-menu conduct-send conduct-triage conduct-settings conduct-tabs conduct-batch conduct-jump; do
  cp conduct-bar/recent.js "$m/"
done
cp conduct-triage/form.js conduct-batch/
for m in conduct-settings conduct-queue conduct-tabs conduct-triage; do
  cp conduct-density/density.js "$m/"
done
```

### Settings tab

In `conduct-settings/main.js` add `import { density } from "./density.js";` (`setShared` is already imported). Add this method to the settings view:

```js
densityTab(t) {
  const current = density();
  return v_flex().gap(8)
    .child(div().text_size(12).text_color(t.muted).child("Adjust spacing for the agent lists."))
    .child(h_flex().gap(8).children([
      ["comfortable", "Comfortable"],
      ["compact", "Compact"],
    ].map(([mode, label]) => {
      const active = current === mode;
      return h_flex().id(`density-${mode}`).h(30).px(12).items_center().rounded(8)
        .cursor_pointer().text_size(12).border_1().border_color(active ? t.accent : t.border)
        .bg(active ? t.accent : t.raised).text_color(active ? t.accent_foreground : t.foreground)
        .on_click(this.on(() => { setShared("conduct.density", mode); this.cx.notify(); }))
        .child(label);
    })));
}
```

Insert `.child(tabBtn("density", "Density"))` directly after the Themes tab button. Replace the current conditional inside the scrolling `s-body` with:

```js
.child(this.tab === "density" ? this.densityTab(t) : this.tab === "keys" ? this.keysTab(t) : this.themesTab(t))
```

### Queue, tabs and inbox

In `conduct-queue/main.js`, add `import { density, SPACING } from "./density.js";` and insert `const d = SPACING[density()];` as the first statement in each of the following methods. Apply these replacements within each method only:

| Method | Existing expression | Replacement |
| --- | --- | --- |
| `row` | `.px(10).py(7).gap(4)` | `.px(d.rowX).py(d.rowY).gap(d.cardGap).min_h(d.cardMinHeight)` |
| `row` | `h_flex().gap(9)`, `h_flex().gap(6)` | `h_flex().gap(d.headingGap)`, `h_flex().gap(d.detailGap)` |
| `row` | `.text_size(12)`, `.text_size(10)`, `.text_size(9)` | `.text_size(d.titleSize)`, `.text_size(d.detailSize)`, `.text_size(d.badgeSize)` |
| `line` | `.px(8).py(4).gap(8)` | `.px(d.lineX).py(d.lineY).gap(d.lineGap)` |
| `line` | `.text_size(11)`, `.text_size(10)` | `.text_size(d.lineSize)`, `.text_size(d.detailSize)` |
| `primary` | `.mt(10)` | `.mt(d.primaryMargin)` |
| `primary` | `.px(8).py(6).gap(8)` on the header | `.px(d.lineX).py(d.primaryY).gap(d.lineGap).min_h(d.cardMinHeight)` |
| `primary` | `.pt(5).pb(2).gap(4)` on the chip container | `.pt(d.lineY + 1).pb(2).gap(d.cardGap)` |
| `primary` | `.px(8).py(4).gap(6)` on both folds | `.px(d.lineX).py(d.lineY).gap(d.detailGap)` |
| `primary` | `.text_size(12)`, `.text_size(10)`, `.text_size(9)` | `.text_size(d.titleSize)`, `.text_size(d.detailSize)`, `.text_size(d.badgeSize)` |

For tabs, the renderable chips can use `.text_size(SPACING[density()].tabTextSize)` in `conduct-tabs/main.js` after importing the same helpers. The actual 34px strip is allocated by the layout. `tabHeight` is available for an eventual density-aware strip and the fixed layout can keep its current allocation. In `conduct-triage/main.js`, after importing the helpers, the main `c-body` can use `.gap(SPACING[density()].inboxGap)` and the 12px preview card padding can use `.p(SPACING[density()].inboxCardPadding)`. No pane or layout edits are required.

## Verification

The prescribed Node 24 unit tests cover grouping, normalization, form exclusion, fuzzy ranking and recent navigation. All JavaScript files were syntax-checked. All three `herdr-app check` calls exited before mod loading because the sandbox denied the Wayland socket connection (OS error 1). The worktree's Git metadata is outside the writable workspace, so staging requires a session that can write its index.

In the live window, verify search-field focus, Up/Down scrolling, Enter and Esc, and any desktop conflict with `ctrl-alt-tab`. Try the batch dialog with identical prompts, a permission prompt, one Claude question form and a recipient that changes state between clicks. Check that the preview and confirmation agree, replies and per-agent outcomes correspond, and card controls remain reachable at higher zoom. Reads use `hc read <address> --lines 30` and the dialog rechecks each selected agent before sending. Prompt extraction prefers the agent's reported message and falls back to the visible tail. A prompt may still change in the interval between the final read and send. Check that switching the Density tab updates the integrated consumers and that their Compact rows remain readable at the narrowest sidebar width.
