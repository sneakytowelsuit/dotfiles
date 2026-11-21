#!/bin/sh
# A real but cheap blocked agent: Haiku asked to put one question to you, then stop. Costs a few cents.
# Run from a terminal inside Herdr so it becomes a sub-agent of that terminal. Several: haiku-question.sh 3
n=${1:-1}
for i in $(seq 1 "$n"); do
  hc run --bg --name "haiku-q$i" --cwd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)" \
    claude --model haiku "Use the AskUserQuestion tool to ask me one question: 'Option $i: which color for the button?' with options Red and Blue. Do nothing else until I answer. Keep every reply under 10 words."
done
