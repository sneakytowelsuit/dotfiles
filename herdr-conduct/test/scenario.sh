#!/bin/sh
# Spawn fake sub-agents under the terminal this runs in (the "primary"). No tokens are spent.
# usage: scenario.sh up [n] | down
here=$(cd "$(dirname "$0")" && pwd)
case "$1" in
  down) for t in $(hc ls --json | python3 -c "import json,sys;[print(x['address']) for x in json.load(sys.stdin)['terminals'] if x.get('name','') and x['name'].startswith('fake-')]" 2>/dev/null); do hc kill "$t" >/dev/null; done ;;
  *)
    n=${2:-12}; i=0
    set -- blocked blocked done working working working working idle idle idle error working
    for s in "$@"; do
      i=$((i+1)); [ "$i" -gt "$n" ] && break
      hc run --bg --name "fake-$i" "$here/fake-agent.sh" "$s" "worker-$i" "task $i" >/dev/null
    done ;;
esac
