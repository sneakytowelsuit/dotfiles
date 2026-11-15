-- Window and layer rules. Find a window's class with `hyprctl clients`.

-- Picture-in-picture video floats.
hl.window_rule({
	name = "pip-float",
	match = { title = "^Picture-in-Picture$" },
	float = true,
})

-- Noctalia's settings window floats (from Noctalia's Hyprland docs).
hl.window_rule({
	name = "noctalia-settings",
	match = { class = "dev.noctalia.Noctalia" },
	float = true,
	size = { 1080, 920 },
})

-- Blur behind Noctalia's bar, panels and notifications.
hl.layer_rule({
	name = "noctalia",
	match = { namespace = "^noctalia-(bar-.+|notification|dock|panel|attached-panel|osd|window-switcher)$" },
	no_anim = true,
	ignore_alpha = 0.5,
	blur = true,
	blur_popups = true,
})
