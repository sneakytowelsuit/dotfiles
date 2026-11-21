#!/usr/bin/env python3
"""Writes the conduct themes (one Herdr theme file each) from the palettes below.
Run:  python3 generate.py     then copy *.json (not index.json is needed too) to ~/.config/herdr-app/themes/.
Palette keys: bg (terminal background), mantle (bars), crust (behind cards), s0 s1 s2 (raised steps), dim, sub (muted text),
fg, accent, red, red2, orange, yellow, green, cyan, blue, purple, pink.  light=True flips hover/ink choices."""
import json, os

P = [
 # name, label, family, light, palette
 ("catppuccin-mocha", "Mocha", "Catppuccin", False, dict(bg="#1e1e2e", mantle="#181825", crust="#11111b", s0="#313244", s1="#45475a", s2="#585b70", dim="#6c7086", sub="#a6adc8", fg="#cdd6f4", accent="#cba6f7", red="#f38ba8", red2="#eba0ac", orange="#fab387", yellow="#f9e2af", green="#a6e3a1", cyan="#94e2d5", blue="#89b4fa", purple="#cba6f7", pink="#f5c2e7")),
 ("catppuccin-macchiato", "Macchiato", "Catppuccin", False, dict(bg="#24273a", mantle="#1e2030", crust="#181926", s0="#363a4f", s1="#494d64", s2="#5b6078", dim="#6e738d", sub="#a5adcb", fg="#cad3f5", accent="#c6a0f6", red="#ed8796", red2="#ee99a0", orange="#f5a97f", yellow="#eed49f", green="#a6da95", cyan="#8bd5ca", blue="#8aadf4", purple="#c6a0f6", pink="#f5bde6")),
 ("catppuccin-frappe", "Frappé", "Catppuccin", False, dict(bg="#303446", mantle="#292c3c", crust="#232634", s0="#414559", s1="#51576d", s2="#626880", dim="#737994", sub="#a5adce", fg="#c6d0f5", accent="#ca9ee6", red="#e78284", red2="#ea999c", orange="#ef9f76", yellow="#e5c890", green="#a6d189", cyan="#81c8be", blue="#8caaee", purple="#ca9ee6", pink="#f4b8e4")),
 ("catppuccin-latte", "Latte", "Catppuccin", True, dict(bg="#eff1f5", mantle="#e6e9ef", crust="#dce0e8", s0="#ccd0da", s1="#bcc0cc", s2="#acb0be", dim="#9ca0b0", sub="#6c6f85", fg="#4c4f69", accent="#8839ef", red="#d20f39", red2="#e64553", orange="#fe640b", yellow="#df8e1d", green="#40a02b", cyan="#179299", blue="#1e66f5", purple="#8839ef", pink="#ea76cb")),
 ("nord", "Nord", "Nord", False, dict(bg="#2e3440", mantle="#2b303b", crust="#252a33", s0="#3b4252", s1="#434c5e", s2="#4c566a", dim="#616e88", sub="#d8dee9", fg="#eceff4", accent="#88c0d0", red="#bf616a", red2="#d08770", orange="#d08770", yellow="#ebcb8b", green="#a3be8c", cyan="#8fbcbb", blue="#81a1c1", purple="#b48ead", pink="#b48ead")),
 ("gruvbox-dark", "Dark", "Gruvbox", False, dict(bg="#282828", mantle="#1d2021", crust="#181818", s0="#3c3836", s1="#504945", s2="#665c54", dim="#928374", sub="#d5c4a1", fg="#ebdbb2", accent="#fabd2f", red="#fb4934", red2="#cc241d", orange="#fe8019", yellow="#fabd2f", green="#b8bb26", cyan="#8ec07c", blue="#83a598", purple="#d3869b", pink="#d3869b")),
 ("gruvbox-light", "Light", "Gruvbox", True, dict(bg="#fbf1c7", mantle="#f2e5bc", crust="#ebdbb2", s0="#ebdbb2", s1="#d5c4a1", s2="#bdae93", dim="#928374", sub="#665c54", fg="#3c3836", accent="#b57614", red="#9d0006", red2="#cc241d", orange="#af3a03", yellow="#b57614", green="#79740e", cyan="#427b58", blue="#076678", purple="#8f3f71", pink="#8f3f71")),
 ("rose-pine", "Rosé Pine", "Rosé Pine", False, dict(bg="#191724", mantle="#16141f", crust="#12101a", s0="#1f1d2e", s1="#26233a", s2="#403d52", dim="#6e6a86", sub="#908caa", fg="#e0def4", accent="#c4a7e7", red="#eb6f92", red2="#b4637a", orange="#ebbcba", yellow="#f6c177", green="#9ccfd8", cyan="#9ccfd8", blue="#31748f", purple="#c4a7e7", pink="#ebbcba")),
 ("rose-pine-moon", "Moon", "Rosé Pine", False, dict(bg="#232136", mantle="#1f1d30", crust="#191726", s0="#2a273f", s1="#393552", s2="#44415a", dim="#6e6a86", sub="#908caa", fg="#e0def4", accent="#c4a7e7", red="#eb6f92", red2="#b4637a", orange="#ea9a97", yellow="#f6c177", green="#9ccfd8", cyan="#9ccfd8", blue="#3e8fb0", purple="#c4a7e7", pink="#ea9a97")),
 ("rose-pine-dawn", "Dawn", "Rosé Pine", True, dict(bg="#faf4ed", mantle="#f4ede8", crust="#f2e9e1", s0="#fffaf3", s1="#f2e9e1", s2="#dfdad9", dim="#9893a5", sub="#797593", fg="#575279", accent="#907aa9", red="#b4637a", red2="#d7827e", orange="#d7827e", yellow="#ea9d34", green="#56949f", cyan="#56949f", blue="#286983", purple="#907aa9", pink="#d7827e")),
 ("dracula", "Dracula", "Dracula", False, dict(bg="#282a36", mantle="#21222c", crust="#191a21", s0="#343746", s1="#44475a", s2="#565a72", dim="#6272a4", sub="#bfbfbf", fg="#f8f8f2", accent="#bd93f9", red="#ff5555", red2="#ff6e6e", orange="#ffb86c", yellow="#f1fa8c", green="#50fa7b", cyan="#8be9fd", blue="#8be9fd", purple="#bd93f9", pink="#ff79c6")),
 ("tokyo-night", "Night", "Tokyo Night", False, dict(bg="#1a1b26", mantle="#16161e", crust="#13131a", s0="#1f2335", s1="#292e42", s2="#3b4261", dim="#565f89", sub="#a9b1d6", fg="#c0caf5", accent="#7aa2f7", red="#f7768e", red2="#db4b4b", orange="#ff9e64", yellow="#e0af68", green="#9ece6a", cyan="#7dcfff", blue="#7aa2f7", purple="#bb9af7", pink="#bb9af7")),
 ("tokyo-night-storm", "Storm", "Tokyo Night", False, dict(bg="#24283b", mantle="#1f2335", crust="#1a1e2e", s0="#292e42", s1="#343a55", s2="#3b4261", dim="#565f89", sub="#a9b1d6", fg="#c0caf5", accent="#7aa2f7", red="#f7768e", red2="#db4b4b", orange="#ff9e64", yellow="#e0af68", green="#9ece6a", cyan="#7dcfff", blue="#7aa2f7", purple="#bb9af7", pink="#bb9af7")),
 ("solarized-dark", "Dark", "Solarized", False, dict(bg="#002b36", mantle="#00252e", crust="#001f27", s0="#073642", s1="#0d4655", s2="#586e75", dim="#586e75", sub="#93a1a1", fg="#839496", accent="#268bd2", red="#dc322f", red2="#cb4b16", orange="#cb4b16", yellow="#b58900", green="#859900", cyan="#2aa198", blue="#268bd2", purple="#6c71c4", pink="#d33682")),
 ("solarized-light", "Light", "Solarized", True, dict(bg="#fdf6e3", mantle="#f5eed9", crust="#eee8d5", s0="#eee8d5", s1="#e3dcc6", s2="#93a1a1", dim="#93a1a1", sub="#586e75", fg="#657b83", accent="#268bd2", red="#dc322f", red2="#cb4b16", orange="#cb4b16", yellow="#b58900", green="#859900", cyan="#2aa198", blue="#268bd2", purple="#6c71c4", pink="#d33682")),
 ("everforest-dark", "Everforest", "Everforest", False, dict(bg="#2d353b", mantle="#272e33", crust="#232a2e", s0="#343f44", s1="#3d484d", s2="#475258", dim="#7a8478", sub="#9da9a0", fg="#d3c6aa", accent="#a7c080", red="#e67e80", red2="#e69875", orange="#e69875", yellow="#dbbc7f", green="#a7c080", cyan="#83c092", blue="#7fbbb3", purple="#d699b6", pink="#d699b6")),
 ("kanagawa", "Kanagawa", "Kanagawa", False, dict(bg="#1f1f28", mantle="#1a1a22", crust="#16161d", s0="#2a2a37", s1="#363646", s2="#54546d", dim="#727169", sub="#c8c093", fg="#dcd7ba", accent="#7e9cd8", red="#e46876", red2="#c34043", orange="#ffa066", yellow="#e6c384", green="#98bb6c", cyan="#7aa89f", blue="#7e9cd8", purple="#957fb8", pink="#d27e99")),
 ("github-dark", "GitHub Dark", "GitHub", False, dict(bg="#0d1117", mantle="#010409", crust="#010409", s0="#161b22", s1="#21262d", s2="#30363d", dim="#6e7681", sub="#8b949e", fg="#c9d1d9", accent="#58a6ff", red="#ff7b72", red2="#f85149", orange="#ffa657", yellow="#d29922", green="#3fb950", cyan="#39c5cf", blue="#58a6ff", purple="#d2a8ff", pink="#f778ba")),
]

def theme(light, c):
    ink = c["crust"] if not light else "#ffffff"
    ansi = [c["s1"], c["red2"], c["green"], c["yellow"], c["blue"], c["purple"], c["cyan"], c["sub"],
            c["dim"], c["red"], c["green"], c["yellow"], c["blue"], c["pink"], c["cyan"], c["fg"]]
    sel = c["s2"] if not light else c["s1"]
    return {
        "background": c["bg"], "foreground": c["fg"], "selection": sel, "cursor": c["accent"], "ansi": ansi,
        "colors": {
            "canvas": c["crust"], "chrome": c["mantle"], "surface": c["s0"], "popover": c["s0"], "raised": c["s1"],
            "hover": "#0000000d" if light else "#ffffff0d", "border": c["s1"] if not light else c["s2"], "input": c["s2"],
            "muted": c["sub"], "dim": c["dim"], "accent": c["accent"], "accent_foreground": ink,
            "solid": c["accent"], "solid_foreground": ink,
            "working": c["yellow"], "blocked": c["red"], "done": c["blue"], "idle": c["dim"], "unknown": c["dim"],
        },
    }

here = os.path.dirname(os.path.abspath(__file__))
index = []
for name, label, family, light, c in P:
    json.dump(theme(light, c), open(os.path.join(here, f"{name}.json"), "w"), indent=2, ensure_ascii=False)
    index.append({"name": name, "label": label, "family": family, "light": light})
js = "// Generated by themes/generate.py. Do not edit.\nexport const THEMES = " + json.dumps(
    [dict(i, theme=theme(i["light"], c)) for i, (_n, _l, _f, _li, c) in zip(index, P)], indent=1, ensure_ascii=False) + ";\n"
open(os.path.join(here, "..", "mods", "conduct-settings", "themes.js"), "w").write(js)
print(f"wrote {len(index)} themes")
