# Conduct state glyphs and agent map

## Recipe text

**State glyphs.** Six monochrome, 24 × 24 SVGs distinguish blocked (octagon with an exclamation mark), error (circled X), stalled (pause), done (check), working (open arc), and idle (dot) at 12px. `stateIcon(t, status, size)` uses the same state colours as Conduct. Blocked uses `t.blocked`, error uses `t.ansi1` with a blocked fallback, stalled uses `t.ansi13`, then `t.ansi5`, then blocked, done uses `t.done`, working uses `t.working`, and idle uses `t.dim`. A filled state uses the same contrasting ink as its label. An open arc can spin where the caller requests motion.

**Agent map** (`alt-a`). A 62% × 86% dialog shows one cell per agent, including primary agents and their descendants. Standalone agents are under **Other agents**. Groups containing blocked, error, or stalled agents come first. At 24 agents or fewer the cells are 56px squares with an 18px glyph and a short name. Larger fleets use 22px squares with 12px glyphs. Critical cells fill with their state colour, with a 1.3s opacity loop from 0.85 to 1 behind the glyph. Working cells have an outline pulsing from 0.45 to 1 over 2.2s and an arc rotating every 1.8s. Finished and idle cells use steady state-colour and dim outlines respectively. The 24px legend chips show fleet-wide counts. Click a chip to filter and click it again to clear. Hover over a cell for the name, title, effective state, time in state, and space/tab. Click or press Enter on the focused cell to close the map and go to the agent. Arrow keys move the 2px accent focus ring, scrolling the selected row into view. Left and right continue across row boundaries. Up and down keep the closest column. Esc closes the map. The grid reflows at the current zoom inside a scrollable body.

## Shared-file edits

In `mods/conduct-bar/keys.js`, add these entries inside `ACTIONS`:

```js
  { id: "g.map", scope: "global", label: "Open the agent map", command: "mod.open:conduct-map", def: ["alt-a"] },
  { id: "map.left", scope: "map", label: "Move map focus left", def: ["left"] },
  { id: "map.right", scope: "map", label: "Move map focus right", def: ["right"] },
  { id: "map.up", scope: "map", label: "Move map focus up", def: ["up"] },
  { id: "map.down", scope: "map", label: "Move map focus down", def: ["down"] },
  { id: "map.go", scope: "map", label: "Go to the focused agent", def: ["enter"] },
  { id: "map.close", scope: "map", label: "Close the agent map", def: ["escape"] },
```

The map uses `bindings()` for its `map.*` actions once the shared table is synced. The local `map-keys.js` supplies the same defaults for the standalone track. After syncing, the integrator can remove that file and use `const MAP_ACTIONS = ACTIONS.filter((a) => a.scope === "map"); const bindingList = (action) => bindings(action.id);` in `conduct-map/main.js`, importing `ACTIONS` in place of `byId`.

In `mods/conduct-settings/main.js` add this child after the `group("inbox", …)` call in `keysTab(t)`. The existing settings recorder, per-scope conflict check, reset, and shared persistence already handle the new scope.

```js
.children(group("map", "IN THE AGENT MAP", "Active while the agent map is open."))
```

Add `"alt-a": "mod.open:conduct-map"` inside `"layout:conduct"` in `keys.json`. The map opens from its own `mod.json` overlay declaration. Include both folders when installing the layout.

The map uses the existing `attn.js` `model().list` fields `address`, `parent`, `primary`, `status`, `name`, `title`, `since`, `space`, `spaceName`, `tab`, `tabName`, and `pane`. Keep the model and poller as the sources of effective status and age. Add `conduct-map` to both existing loops in `sync-shared.sh`. Then add this loop after them so each mod can import its local helper while all SVG paths resolve to the same asset folder.

```sh
for m in conduct-map conduct-bar conduct-queue conduct-pane conduct-tabs conduct-triage; do
  cp conduct-glyphs/glyphs.js "$m/"
done
```

Add `import { stateIcon } from "./glyphs.js";` to each of the five existing display mods below. The expressions are intended as children of the existing flex containers.

| File and insertion point | Edit |
|---|---|
| `conduct-bar/main.js`, `count()` | Replace the compact dot branch with one unconditional child before the label/count: `.child(stateIcon(t, status, 12).flex_none().when(loud, (el) => el.text_color(ink(color))))`. Keep the label visible in wide mode. |
| `conduct-queue/main.js`, `row()`, `line()`, and `primary()` | In `row()`, add `.gap(4).child(stateIcon(t, a.status, 12).flex_none().text_color(ink(color)))` to the filled state pill before `NAME[a.status]`. In `line()`, replace the leading dot with `stateIcon(t, a.status, 12).flex_none().when(a.status === "working", (el) => el.spin(1800))` and remove the now-unused local `color`. In `primary()`, replace the status dot with `stateIcon(t, p.status, 12).flex_none()` and remove its unused `color`. |
| `conduct-pane/main.js`, `render()` | Insert `.child(stateIcon(t, st, 12).flex_none().when(loud, (el) => el.text_color(ink(color))))` in the tag before its existing state and age text. |
| `conduct-tabs/main.js`, `tab()` | Replace the 8px dot with a centred `div().flex_none().size(16).flex().items_center().justify_center().rounded_full().border_1().border_color(color).when(loud, (el) => el.bg(color).loop("opacity", { from: 0.85, to: 1, period: 1300 })).child(stateIcon(t, st, 12).when(loud, (el) => el.text_color(ink(color))).when(st === "working", (el) => el.spin(1800)))`. Keep the existing visibility condition and critical count badge. |
| `conduct-triage/main.js`, `render()` active agent card | In the 20px state pill immediately before the agent title, insert `.gap(4).child(stateIcon(t, n.status, 12).flex_none().text_color(ink(color)))` before `NAME[n.status]`. |

## Verification

- Node 24 passes the grouping, cell size, filtering, and keyboard movement tests under `test/map/`. All new JavaScript modules pass `node --check`.
- Both `herdr-app check` invocations abort at startup because the sandbox denies the Wayland compositor connection. Run both again in the Herdr environment.
- In the live window, check SVG tint and distinguishability at 12px in a light theme and a dark theme, and check keyboard focus, legend scrolling, and grid reflow at zoom 1.8. Try a small fleet and roughly 100 agents, including nested sub-agents. Check clicking and pressing Enter land on both a primary pane and a sub-agent peek. Check a remapped open shortcut and a remapped arrow or close binding in settings.
