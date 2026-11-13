# YubiKey (FIDO2/U2F) for sudo, polkit and login. Enabling this adds pam_u2f
# to those services by default; it runs before fingerprint and password.
#
# One-time setup per machine (the key requires its FIDO2 PIN):
#   pamu2fcfg -N > ~/.config/Yubico/u2f_keys
{ pkgs, ... }:

{
  security.pam.u2f = {
    enable = true;
    settings.cue = true; # print "Please touch the device" when waiting
  };

  environment.systemPackages = [ pkgs.pam_u2f ]; # provides `pamu2fcfg`
}
