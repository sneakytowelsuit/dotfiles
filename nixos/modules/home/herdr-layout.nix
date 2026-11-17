# The Dungeon Crawler Carl Herdr layout, managed by Nix.
#
# The layout lives in ../../../herdr-dungeon-crawler (a self-contained folder
# laid out like Herdr's own config home, so anyone can install it from the
# Herdr gallery; see its RECIPE.md). This module links every file the layout
# needs (layouts/, themes/, mods/) into ~/.config/herdr-app.
#
# Files are linked one by one, never the folder: Herdr writes its own files in
# ~/.config/herdr-app (settings, view state, layouts/.state, and the .d.ts and
# jsconfig.json it drops into each mod folder), so those directories must stay
# real. Edit the files in the repo and rebuild; Herdr reloads them live.
{ lib, ... }:

let
  src = ../../../herdr-dungeon-crawler;

  # Only what Herdr loads. The recipe, preview, sprite sources and scripts are
  # for people and for the gallery.
  keep =
    rel:
    lib.any (dir: lib.hasPrefix "${dir}/" rel) [
      "layouts"
      "themes"
      "mods"
    ]
    && !(lib.hasInfix "/sprites/src/" rel)
    && !(lib.hasSuffix "/build.sh" rel);

  relative = file: lib.removePrefix "./" (lib.path.removePrefix src file);

  files = lib.filter (file: keep (relative file)) (lib.filesystem.listFilesRecursive src);
in
{
  xdg.configFile = lib.listToAttrs (
    map (
      file:
      lib.nameValuePair "herdr-app/${relative file}" {
        source = file;
        # The files were first made by hand in ~/.config/herdr-app. Take them
        # over without a .backup copy of each one (they match the repo).
        force = true;
      }
    ) files
  );
}
