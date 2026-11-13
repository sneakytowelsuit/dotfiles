# Herdr desktop app, packaged from upstream's prebuilt Linux tarball.
#
# It isn't in nixpkgs, and building from source needs Rust plus Zig. A
# prebuilt binary expects libraries under /usr/lib, which NixOS doesn't have,
# so autoPatchelfHook rewrites it to load them from the Nix store instead.
#
# To update: take the new version and sha256 from
# https://releases.herdr.dev/app/latest.json, change them below, and rebuild.
{
  lib,
  stdenv,
  fetchurl,
  autoPatchelfHook,
  makeWrapper,
  copyDesktopItems,
  makeDesktopItem,
  libxcb,
  libxkbcommon,
  libGL,
  vulkan-loader,
  wayland,
  herdr-core,
}:

stdenv.mkDerivation (finalAttrs: {
  pname = "herdr-app";
  version = "0.1.15";

  src = fetchurl {
    url = "https://releases.herdr.dev/app/${finalAttrs.version}/herdr-app-linux-x86_64.tar.gz";
    hash = "sha256-+Z4eBL6CwOELL2nudAPKNDhvSA2SUR31hlr0cD52Vd0=";
  };

  nativeBuildInputs = [
    autoPatchelfHook
    makeWrapper
    copyDesktopItems
  ];

  # Libraries the binary links against directly; autoPatchelfHook finds
  # these in its ELF header and points the binary at them.
  buildInputs = [
    stdenv.cc.cc.lib # libgcc_s
    libxcb
    libxkbcommon
  ];

  # Libraries it loads later with dlopen(), which autoPatchelfHook can't see
  # in the header. Listing them here adds them to the binary's search path.
  runtimeDependencies = [
    libGL # libEGL
    vulkan-loader
    wayland
    libxkbcommon # libxkbcommon-x11
  ];

  installPhase = ''
    runHook preInstall

    # The binary looks up its assets next to itself, so keep the files together.
    mkdir -p $out/lib/herdr-app $out/bin
    cp herdr-app herdr-app.svg $out/lib/herdr-app/
    install -Dm644 herdr-app.svg $out/share/icons/hicolor/scalable/apps/herdr-app.svg

    # The app runs on herdr-core, which it finds on PATH. Use nixpkgs' build
    # instead of the app downloading its own into ~/.local/bin.
    # Anonymous usage telemetry is off; --set-default lets you turn it back on
    # for one run with HERDR_TELEMETRY=1.
    makeWrapper $out/lib/herdr-app/herdr-app $out/bin/herdr-app \
      --suffix PATH : ${lib.makeBinPath [ herdr-core ]} \
      --set-default HERDR_TELEMETRY 0

    runHook postInstall
  '';

  # Same entry as upstream's install.sh writes.
  desktopItems = [
    (makeDesktopItem {
      name = "herdr-app";
      desktopName = "Herdr";
      comment = "Terminals and coding agents that keep running";
      exec = "herdr-app";
      icon = "herdr-app";
      categories = [ "Development" ];
      startupWMClass = "herdr-app";
    })
  ];

  meta = {
    description = "Desktop app for terminals and coding agents, built on herdr-core";
    homepage = "https://herdr.dev";
    license = lib.licenses.asl20;
    sourceProvenance = [ lib.sourceTypes.binaryNativeCode ];
    platforms = [ "x86_64-linux" ];
    mainProgram = "herdr-app";
  };
})
