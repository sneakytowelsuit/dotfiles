# Framework hardware validation

Record results on stock Aurora DX Stable before changing the host, then repeat after switching to the custom image. Use `pass`, `fail`, or `untested` with a short note and the image digest from `sudo bootc status`.

| Check | Stock Aurora | Custom image | Notes |
| --- | --- | --- | --- |
| Wi-Fi | untested | untested | |
| Bluetooth | untested | untested | |
| Fingerprint enrollment and unlock | untested | untested | |
| Speakers, microphone, headphone output | untested | untested | |
| Brightness keys and actual panel level | untested | untested | |
| Charging on each USB-C port | untested | untested | |
| USB-C DisplayPort | untested | untested | |
| Suspend and resume | untested | untested | |
| Lid-close suspend | untested | untested | |
| Overnight sleep battery drain | untested | untested | Record start/end charge and hours. |
| External display | untested | untested | |
| Ultrawide native resolution | untested | untested | Record mode. |
| 240 Hz output | untested | untested | Verify actual mode, not just app setting. |
| Niri and Noctalia | n/a | untested | Launcher, notifications, lock, logout, volume, brightness. |
| Plasma fallback | pass on stock | untested | Confirm SDDM selection. |
