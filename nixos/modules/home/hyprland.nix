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

  # Official Framework Laptop 13 Pro wallpaper pack (frame.work/wallpapers),
  # linked where Noctalia's wallpaper rotation below looks for it.
  home.file."Pictures/Wallpapers/framework".source = pkgs.fetchzip {
    url = "https://downloads.frame.work/assets/framework-laptop13pro-wallpaper-pack.zip";
    hash = "sha256-BHo7glMjORE5IPRPTfScJ4QBXqiu/+Ga7oruH6rHYms=";
    stripRoot = false;
    # frame.work's CDN rejects curl's default User-Agent.
    curlOptsList = [ "-A" "Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0" ];
  };

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
      bar.default = {
        start = [ "launcher" "cpu" "ram" "temp" ];
        center = [ "workspaces" "clock" "active_window" ];
        end = [
          "media"
          "tray"
          "notifications"
          "clipboard"
          "network"
          "bluetooth"
          "volume"
          "brightness"
          "power_profile"
          "battery"
          "control-center"
          "session"
        ];
      };
      theme = {
        source = "community";
        community_palette = "Garnet";
        builtin = "Dracula";
        mode = "dark";
        wallpaper_scheme = "vibrant";
        templates.builtin_ids = [ "ghostty" "hyprland" ];
      };
      widget = {
        clock.format = "{:%-I:%M %p}";
        media = {
          album_art_only = true;
          hide_when_no_media = true;
        };
        network = {
          show_label = false;
          vpn_status = "both";
        };
      };
      wallpaper = {
        directory = "/home/austin/Pictures/Wallpapers/framework";
        automation = {
          enabled = true;
          interval_seconds = 1800; # rotate every 30 minutes
          order = "random";
        };
      };
      # Locking and screen-off are handled by hypridle + hyprlock below.
      idle.behavior = {
        lock.enabled = false;
        screen-off.enabled = false;
      };
    };
  };

  # hyprlock: the lock screen. It authenticates through PAM (service
  # "hyprlock", declared in modules/nixos/hyprland.nix), so it gets the same
  # YubiKey -> password chain as login. Fingerprint is left to PAM too.
  programs.hyprlock = {
    enable = true;
    settings = {
      general.hide_cursor = true;
      background = [
        {
          path = "screenshot";
          blur_passes = 3;
          blur_size = 6;
        }
      ];
      input-field = [
        {
          size = "320, 56";
          position = "0, -80";
          halign = "center";
          valign = "center";
          fade_on_empty = false;
          # Shows whatever PAM is asking for right now: the key PIN, "touch
          # the FIDO authenticator", the fingerprint prompt, or the password.
          placeholder_text = "$PAMPROMPT";
          fail_text = "$PAMFAIL";
        }
      ];
      label = [
        {
          text = "1. Key PIN + Enter   2. Touch key when asked   (or fingerprint / password)";
          font_size = 14;
          color = "rgba(255, 255, 255, 0.7)";
          position = "0, -150";
          halign = "center";
          valign = "center";
        }
        {
          text = "$TIME";
          font_size = 72;
          position = "0, 120";
          halign = "center";
          valign = "center";
        }
      ];
    };
  };

  # hypridle: lock after 10 minutes, screens off after 11, and lock before
  # suspend. `loginctl lock-session` (also what the lock keybind runs) goes
  # through lock_cmd, so only one hyprlock ever runs.
  services.hypridle = {
    enable = true;
    settings = {
      general = {
        lock_cmd = "pidof hyprlock || hyprlock";
        before_sleep_cmd = "loginctl lock-session";
        after_sleep_cmd = "hyprctl dispatch dpms on";
      };
      listener = [
        {
          timeout = 600;
          on-timeout = "loginctl lock-session";
        }
        {
          timeout = 660;
          on-timeout = "hyprctl dispatch dpms off";
          on-resume = "hyprctl dispatch dpms on";
        }
      ];
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
            (itemBind "l" "Lock" "Super+BackSpace" "loginctl lock-session")
            (item "s" "Suspend" "sh -c 'loginctl lock-session && systemctl suspend'")
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
