# Hyprland session (per-user side): the compositor config, the Noctalia shell
# (bar, launcher, notifications, lock screen, idle, OSD, polkit prompts) and a
# wlr-which-key menu so keybindings don't have to be memorised.
#
# Hyprland's config is Lua (since 0.55; the old hyprland.conf format was
# dropped in 0.57). Like Doom's Elisp, it's kept as real .lua files in ./hypr
# and Nix only wires them in. Edit them, rebuild, and Hyprland reloads itself.
#
# This module is shared by every host but only turns on where the system
# config enables Hyprland (modules/nixos/hyprland.nix). `osConfig` is that
# NixOS config, which Home Manager passes in because it runs as a NixOS module.
{
  lib,
  pkgs,
  osConfig,
  ...
}:

let
  hyprlandPackage = osConfig.programs.hyprland.package;

  # ./hypr checked by Hyprland itself while building: a typo or unknown
  # option fails `nixos-rebuild` with Hyprland's error message, instead of
  # showing up after you log in. The output is the same .lua files.
  verifiedLua =
    pkgs.runCommand "hyprland-lua-verified" { nativeBuildInputs = [ hyprlandPackage ]; }
      ''
        mkdir -p $out
        cp ${./hypr}/*.lua $out/
        {
          echo "package.path = \"$out/?.lua;\" .. package.path"
          for f in $out/*.lua; do echo "require(\"$(basename "$f" .lua)\")"; done
        } > check.lua
        export HOME=$TMPDIR XDG_RUNTIME_DIR=$TMPDIR
        Hyprland --verify-config -c check.lua > log 2>&1 || true
        sed -n '/Config parsing result/,$p' log
        grep -qx 'config ok' log
      '';

  # Commands for the which-key menu.
  shell = msg: "noctalia msg ${msg}";
  dispatch = lua: "hyprctl dispatch '${lua}'";
  # A menu entry; `bind` notes the direct shortcut, so the menu doubles as a
  # cheat sheet.
  item = key: desc: cmd: {
    inherit key desc cmd;
  };
  itemBind =
    key: desc: bind: cmd:
    item key "${desc}  (${bind})" cmd;
in
lib.mkIf osConfig.programs.hyprland.enable {
  wayland.windowManager.hyprland = {
    enable = true;
    # The NixOS module installs Hyprland and its portal system-wide; don't
    # install a second copy. (Same pkgs.hyprland either way, via useGlobalPkgs.)
    package = null;
    portalPackage = null;
    configType = "lua"; # the default for this stateVersion; stated for clarity

    # Each file becomes ~/.config/hypr/<name>.lua and is `require`d from the
    # generated hyprland.lua, in name order.
    extraLuaFiles = lib.genAttrs [ "10-settings" "20-binds" "30-rules" ] (
      name: "${verifiedLua}/${name}.lua"
    );

    # UWSM (programs.hyprland.withUWSM) runs the session's systemd side:
    # it starts graphical-session.target, so user services (Emacs, Noctalia)
    # come up. Home Manager's own version of this would clash with it.
    systemd.enable = false;
  };

  # Hyprland's Lua type stubs at a fixed path, for lua-language-server. The
  # repo's top-level .luarc.json points here, so editing ./hypr in Emacs gets
  # completion, docs (K) and diagnostics for the `hl` API. It sits at the repo
  # root because that's the project root eglot gives the server.
  xdg.configFile."hypr/stubs".source = "${hyprlandPackage}/share/hypr/stubs";

  # Noctalia's service hangs off graphical-session.target, which GNOME starts
  # too. Like UWSM's example units, skip it unless the desktop is Hyprland.
  systemd.user.services.noctalia.Service.ExecCondition =
    ''${pkgs.systemd}/lib/systemd/systemd-xdg-autostart-condition "Hyprland" ""'';

  programs.noctalia = {
    enable = true;
    systemd.enable = true; # restarts on crash and when its config changes
    # Written to ~/.config/noctalia/config.toml, on top of Noctalia's defaults.
    # Changes made in Noctalia's settings window are saved separately, in
    # ~/.local/state/noctalia/settings.toml, and win over these.
    settings = {
      shell = {
        polkit_agent = true; # password/YubiKey prompts for pkexec, etc.
        # Apps started from the launcher keep running if Noctalia restarts.
        launch_apps_as_systemd_services = true;
      };
      idle.behavior = {
        lock.enabled = true; # 10 minutes
        screen-off.enabled = true; # 11 minutes
      };
    };
  };

  # wlr-which-key: Super+Space opens this menu (bound in ./hypr/20-binds.lua).
  programs.wlr-which-key = {
    enable = true;
    settings = {
      font = "monospace 12";
      background = "#1e1e2ee6";
      color = "#cdd6f4";
      border = "#7fc8ff";
      separator = "  ";
      border_width = 2;
      corner_r = 10;
      padding = 15;
      rows_per_column = 8;
      column_padding = 25;
      anchor = "center";

      menu = [
        {
          key = "a";
          desc = "Apps";
          submenu = [
            (itemBind "t" "Herdr" "Super+T" "herdr-app")
            (itemBind "g" "Ghostty" "Super+Shift+T" "ghostty")
            (itemBind "b" "Browser" "Super+B" "zen-beta")
            (itemBind "e" "Emacs" "Super+E" "emacsclient -c")
            (item "f" "Files" "nautilus")
            (itemBind "l" "Launcher" "Super+D" (shell "panel-toggle launcher"))
          ];
        }
        {
          key = "w";
          desc = "Window";
          submenu = [
            (itemBind "f" "Maximize" "Super+F" (dispatch ''hl.dsp.window.fullscreen({ mode = "maximized" })''))
            (itemBind "F" "Fullscreen" "Super+Shift+F" (
              dispatch ''hl.dsp.window.fullscreen({ mode = "fullscreen" })''
            ))
            (itemBind "v" "Toggle floating" "Super+V" (dispatch ''hl.dsp.window.float({ action = "toggle" })''))
            (itemBind "c" "Center column" "Super+C" (dispatch ''hl.dsp.layout("center")''))
            (itemBind "g" "Tabbed group" "Super+W" (dispatch "hl.dsp.group.toggle()"))
            (itemBind "s" "Send to scratchpad" "Super+Shift+S" (
              dispatch ''hl.dsp.window.move({ workspace = "special:scratch" })''
            ))
            (itemBind "q" "Close" "Super+Q" (dispatch "hl.dsp.window.close()"))
          ];
        }
        {
          key = "c";
          desc = "Columns";
          submenu = [
            (itemBind "r" "Next width preset" "Super+R" (dispatch ''hl.dsp.layout("colresize +conf")''))
            (itemBind "R" "Previous width preset" "Super+Shift+R" (
              dispatch ''hl.dsp.layout("colresize -conf")''
            ))
            (itemBind "=" "Wider" "Super+=" (dispatch ''hl.dsp.layout("colresize +0.1")''))
            (itemBind "-" "Narrower" "Super+-" (dispatch ''hl.dsp.layout("colresize -0.1")''))
            (itemBind "," "Pull window into column" "Super+," (dispatch ''hl.dsp.layout("consume")''))
            (itemBind "." "Push window out" "Super+." (dispatch ''hl.dsp.layout("expel")''))
          ];
        }
        {
          key = "n";
          desc = "Navigate";
          submenu = [
            (itemBind "h" "Focus left" "Super+H / ←" (dispatch ''hl.dsp.focus({ direction = "l" })''))
            (itemBind "l" "Focus right" "Super+L / →" (dispatch ''hl.dsp.focus({ direction = "r" })''))
            (itemBind "H" "Move column left" "Super+Ctrl+H" (dispatch ''hl.dsp.layout("swapcol l")''))
            (itemBind "L" "Move column right" "Super+Ctrl+L" (dispatch ''hl.dsp.layout("swapcol r")''))
            (itemBind "u" "Next workspace" "Super+U · Super+1-9" (
              dispatch ''hl.dsp.focus({ workspace = "r+1" })''
            ))
            (itemBind "i" "Previous workspace" "Super+I" (dispatch ''hl.dsp.focus({ workspace = "r-1" })''))
            (itemBind "U" "Window to next workspace" "Super+Ctrl+U · Super+Ctrl+1-9" (
              dispatch ''hl.dsp.window.move({ workspace = "r+1" })''
            ))
            (itemBind "s" "Scratchpad" "Super+S" (dispatch ''hl.dsp.workspace.toggle_special("scratch")''))
            (itemBind "m" "Other monitor" "Super+Shift+HJKL" (dispatch ''hl.dsp.focus({ monitor = "r" })''))
            (itemBind "Tab" "Window switcher" "Alt+Tab" (shell "window-switcher hold"))
          ];
        }
        {
          key = "s";
          desc = "Screenshot";
          submenu = [
            (itemBind "r" "Region" "Print" (shell "screenshot-region"))
            (itemBind "s" "Screen" "Ctrl+Print" (shell "screenshot-fullscreen"))
            (itemBind "w" "Window" "Alt+Print" (shell "screenshot-window"))
            (item "a" "Region, then annotate" (shell "screenshot-annotate"))
          ];
        }
        {
          key = "o";
          desc = "Shell";
          submenu = [
            (item "c" "Control center" (shell "panel-toggle control-center"))
            (item "v" "Clipboard history" (shell "panel-toggle clipboard"))
            (item "w" "Wallpaper" (shell "panel-toggle wallpaper"))
            (item "n" "Clear notifications" (shell "notification-clear-history"))
            (item "s" "Settings" (shell "settings-toggle"))
          ];
        }
        {
          key = "t";
          desc = "Toggle";
          submenu = [
            (item "d" "Do not disturb" (shell "notification-dnd-toggle"))
            (item "n" "Night light" (shell "nightlight-toggle"))
            (item "c" "Caffeine (stay awake)" (shell "caffeine-toggle"))
            (item "t" "Dark/light theme" (shell "theme-mode-toggle"))
            (item "w" "Wi-Fi" (shell "wifi-toggle"))
            (item "b" "Bluetooth" (shell "bluetooth-toggle"))
            (item "p" "Power profile" (shell "power-cycle"))
            (item "B" "Bar" (shell "bar-toggle"))
          ];
        }
        {
          key = "p";
          desc = "Power";
          submenu = [
            (itemBind "l" "Lock" "Super+Alt+L" (shell "session lock"))
            (item "s" "Suspend" (shell "session lock-and-suspend"))
            (itemBind "d" "Displays off" "Super+Shift+P" (shell "dpms-off"))
            (item "o" "Log out" (shell "session logout"))
            (item "r" "Reboot" (shell "session reboot"))
            (item "S" "Shut down" (shell "session shutdown"))
          ];
        }
        (item "r" "Reload Hyprland config" "hyprctl reload")
      ];
    };
  };
}
