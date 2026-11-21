-- Look and behaviour. Loaded first (files load in name order).
-- Every option: https://wiki.hypr.land/Configuring/ . In Emacs, K on any `hl.`
-- call shows its docs, and typos are underlined (via ~/.config/hypr/stubs).

-- The laptop panel at 2x; anything plugged in gets its preferred mode, placed
-- automatically (the rule with an empty output is the fallback).
hl.monitor({ output = "eDP-1", mode = "preferred", position = "auto", scale = 2 })
hl.monitor({ output = "", mode = "preferred", position = "auto", scale = "auto" })

-- The cursor: keep the name and size in step with modules/home/cursor.nix. Bibata is an xcursor
-- theme with no hyprcursor build, so hyprcursor is switched off below and Hyprland loads it by
-- XCURSOR_THEME. (With no theme named at all it drew a bare fallback: no hand, text beam or grab.)
hl.env("XCURSOR_THEME", "Bibata-Modern-Classic")
hl.env("XCURSOR_SIZE", "10")

hl.config({
	cursor = {
		enable_hyprcursor = false, -- use the xcursor theme named above
	},

	general = {
		-- niri-style: windows sit in columns on an endless horizontal strip.
		layout = "scrolling",
		gaps_in = 8,
		gaps_out = 16,
		border_size = 3,
		col = {
			active_border = "rgba(7fc8ffff)", -- niri's focus-ring colour
			inactive_border = "rgba(505050ff)",
		},
	},

	scrolling = {
		column_width = 0.5, -- new columns take half the screen
		explicit_column_widths = "0.333, 0.5, 0.667, 1.0", -- cycled by Super+R
		focus_fit_method = 1, -- scroll just enough to fit the focused column
	},

	decoration = {
		rounding = 10,
		shadow = { enabled = true, range = 30, render_power = 3, color = "rgba(00000077)" },
		blur = { enabled = true, size = 3, passes = 2, vibrancy = 0.1696 },
	},

	input = {
		kb_layout = "us",
		-- Caps Lock = Esc on tap, Ctrl on hold: done below the desktop by keyd
		-- (modules/nixos/keyboard.nix), so no kb_options here.
		follow_mouse = 1,
		touchpad = {
			natural_scroll = true,
			tap_to_click = true,
			disable_while_typing = true,
		},
	},

	misc = {
		-- Noctalia draws the wallpaper; skip Hyprland's built-in one.
		force_default_wallpaper = 0,
		disable_hyprland_logo = true,
		disable_splash_rendering = true,
	},
})

-- Touchpad, like niri: three-finger swipe left/right scrolls through the
-- columns ("the tape"), up/down changes workspace.
hl.gesture({ fingers = 3, direction = "horizontal", action = "scroll_move" })
hl.gesture({ fingers = 3, direction = "vertical", action = "workspace" })
