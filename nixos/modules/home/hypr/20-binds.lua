-- Keybindings, ported from the Aurora niri config.
--
-- Can't remember one? Super+Space opens the which-key menu
-- (programs.wlr-which-key in ../hyprland.nix), which lists these
-- by category and can run them too.

local mod = "SUPER"
local function key(k)
	return mod .. " + " .. k
end
local function run(cmd)
	return hl.dsp.exec_cmd(cmd)
end
local function shell(msg) -- Noctalia's command interface
	return run("noctalia msg " .. msg)
end

------------------------------------------------------------------ menus / apps
hl.bind(key("SPACE"), run("wlr-which-key"), { desc = "Which-key menu" })
hl.bind(key("SHIFT + SLASH"), run("wlr-which-key"), { desc = "Which-key menu" })
hl.bind(key("D"), shell("panel-toggle launcher"), { desc = "App launcher" })
hl.bind(key("T"), run("herdr-app"), { desc = "Terminal (Herdr)" })
hl.bind(key("SHIFT + T"), run("ghostty"), { desc = "Terminal (Ghostty)" })
hl.bind(key("B"), run("zen-beta"), { desc = "Browser" })
hl.bind(key("E"), run("emacsclient -c"), { desc = "Emacs" })
hl.bind("ALT + TAB", shell("window-switcher hold"), { desc = "Window switcher" })

----------------------------------------------------------------------- windows
hl.bind(key("Q"), hl.dsp.window.close(), { desc = "Close window" })
hl.bind(key("V"), hl.dsp.window.float({ action = "toggle" }), { desc = "Toggle floating" })
hl.bind(key("F"), hl.dsp.window.fullscreen({ mode = "maximized" }), { desc = "Maximize" })
hl.bind(key("SHIFT + F"), hl.dsp.window.fullscreen({ mode = "fullscreen" }), { desc = "Fullscreen" })
hl.bind(key("C"), hl.dsp.layout("center"), { desc = "Center column" })
hl.bind(key("W"), hl.dsp.group.toggle(), { desc = "Toggle tabbed group" })

-- Focus with hjkl or arrows; add Ctrl to move. Left/right are columns,
-- up/down are windows stacked inside a column. As in niri, Ctrl+left/right
-- moves the whole column (swapcol); Ctrl+up/down moves the window within it.
local dirs = {
	{ "H", "LEFT", "l", hl.dsp.layout("swapcol l") },
	{ "J", "DOWN", "d", hl.dsp.window.move({ direction = "d" }) },
	{ "K", "UP", "u", hl.dsp.window.move({ direction = "u" }) },
	{ "L", "RIGHT", "r", hl.dsp.layout("swapcol r") },
}
for _, d in ipairs(dirs) do
	local vim, arrow, dir, move = d[1], d[2], d[3], d[4]
	for _, k in ipairs({ vim, arrow }) do
		hl.bind(key(k), hl.dsp.focus({ direction = dir }))
		hl.bind(key("CTRL + " .. k), move)
		-- Shift: other monitor.
		hl.bind(key("SHIFT + " .. k), hl.dsp.focus({ monitor = dir }))
		hl.bind(key("SHIFT + CTRL + " .. k), hl.dsp.window.move({ monitor = dir }))
	end
end

-- Columns (scrolling layout).
hl.bind(key("R"), hl.dsp.layout("colresize +conf"), { desc = "Next column width preset" })
hl.bind(key("SHIFT + R"), hl.dsp.layout("colresize -conf"), { desc = "Previous width preset" })
hl.bind(key("MINUS"), hl.dsp.layout("colresize -0.1"), { desc = "Narrower column", repeating = true })
hl.bind(key("EQUAL"), hl.dsp.layout("colresize +0.1"), { desc = "Wider column", repeating = true })
hl.bind(key("COMMA"), hl.dsp.layout("consume"), { desc = "Pull window into column" })
hl.bind(key("PERIOD"), hl.dsp.layout("expel"), { desc = "Push window out of column" })
hl.bind(key("BRACKETLEFT"), hl.dsp.layout("consume_or_expel prev"), { desc = "Window into/out of left column" })
hl.bind(key("BRACKETRIGHT"), hl.dsp.layout("consume_or_expel next"), { desc = "Window into/out of right column" })

-- Mouse: Super+drag moves, Super+right-drag resizes.
hl.bind(key("mouse:272"), hl.dsp.window.drag(), { mouse = true })
hl.bind(key("mouse:273"), hl.dsp.window.resize(), { mouse = true })

-------------------------------------------------------------------- workspaces
for i = 1, 9 do
	hl.bind(key(tostring(i)), hl.dsp.focus({ workspace = i }))
	hl.bind(key("CTRL + " .. i), hl.dsp.window.move({ workspace = i }))
end
-- Up/down through workspaces like niri (U/I or Page Up/Down; Ctrl moves the
-- window along). "r+1" is the next workspace number, created if empty.
for _, k in ipairs({ { "U", "NEXT", "r+1" }, { "I", "PRIOR", "r-1" } }) do
	for _, kk in ipairs({ k[1], k[2] }) do
		hl.bind(key(kk), hl.dsp.focus({ workspace = k[3] }))
		hl.bind(key("CTRL + " .. kk), hl.dsp.window.move({ workspace = k[3] }))
	end
end
hl.bind(key("mouse_down"), hl.dsp.focus({ workspace = "e+1" }))
hl.bind(key("mouse_up"), hl.dsp.focus({ workspace = "e-1" }))

-- Scratchpad: a hidden workspace that pops over the current one.
hl.bind(key("S"), hl.dsp.workspace.toggle_special("scratch"), { desc = "Toggle scratchpad" })
hl.bind(key("SHIFT + S"), hl.dsp.window.move({ workspace = "special:scratch" }), { desc = "Send to scratchpad" })

----------------------------------------------------------- screenshots/session
hl.bind("PRINT", shell("screenshot-region"), { desc = "Screenshot region" })
hl.bind("CTRL + PRINT", shell("screenshot-fullscreen"), { desc = "Screenshot screen" })
hl.bind("ALT + PRINT", shell("screenshot-window"), { desc = "Screenshot window" })
hl.bind(key("BACKSPACE"), run("loginctl lock-session"), { desc = "Lock screen" })
hl.bind(key("SHIFT + E"), shell("panel-toggle session"), { desc = "Session menu" })
hl.bind("CTRL + ALT + DELETE", shell("panel-toggle session"), { desc = "Session menu" })
hl.bind(key("SHIFT + P"), shell("dpms-off"), { desc = "Turn displays off" })

-------------------------------------------------- hardware keys (work locked)
local hw = { locked = true, repeating = true }
hl.bind("XF86AudioRaiseVolume", shell("volume-up"), hw)
hl.bind("XF86AudioLowerVolume", shell("volume-down"), hw)
hl.bind("XF86AudioMute", shell("volume-mute"), { locked = true })
hl.bind("XF86AudioMicMute", shell("mic-mute"), { locked = true })
hl.bind("XF86MonBrightnessUp", shell("brightness-up"), hw)
hl.bind("XF86MonBrightnessDown", shell("brightness-down"), hw)
hl.bind("XF86AudioPlay", run("playerctl play-pause"), { locked = true })
hl.bind("XF86AudioPause", run("playerctl play-pause"), { locked = true })
hl.bind("XF86AudioNext", run("playerctl next"), { locked = true })
hl.bind("XF86AudioPrev", run("playerctl previous"), { locked = true })
