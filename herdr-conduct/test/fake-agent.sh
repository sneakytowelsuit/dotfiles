#!/bin/sh
# A stand-in agent that costs no tokens: reports a status over OSC 7501, prints a Claude-like
# activity line, and echoes whatever it is sent (so nudges and replies can be checked).
# usage: fake-agent.sh <idle|working|blocked|done|error> [title] [msg]
state=${1:-idle}; title=${2:-fake}; msg=${3:-}
printf '\033]0;%s\007' "$title"
printf '\033]7501;1:state=%s:app=claude-code' "$state"
[ -n "$msg" ] && printf ':msg=%s' "$msg"
[ "$state" = blocked ] && printf ':kind=question'
printf '\007'
[ "$state" = working ] && printf '\n✻ Thingamajigging… (12s · ↓ 1.2k tokens)\n'
echo "[$title] state=$state"
while IFS= read -r line; do echo "[$title] got: $line"; done
