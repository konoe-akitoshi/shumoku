#!/bin/sh
# Usage: read-batch.sh <types.ts> <network.yaml> <questions.md> <key.md> <out-prefix> <n> [model]
# Runs n blind readers in parallel, grades each, and prints how many got each question right.
here=$(dirname "$0"); model=${7:-gpt-6-luna}
for i in $(seq 1 "$6"); do
  ( "$here/codex-reader.sh" "$1" "$2" "$3" "$model" "$5-$i.md" && "$here/codex-grade.sh" "$4" "$5-$i.md" > /dev/null ) &
done
wait
for g in "$5"-*.md.grade; do cat "$g"; echo; done | awk 'NF{n[$1]++; if ($2=="ok") ok[$1]++} END {for (q in n) printf "%s %d/%d\n", q, ok[q], n[q]}' | sort -V
