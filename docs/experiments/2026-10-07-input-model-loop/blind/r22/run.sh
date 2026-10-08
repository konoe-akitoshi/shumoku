#!/bin/sh
# Usage: run.sh <arm> <example.yaml> <n>  — n luna writers, each with up to 3 fix rounds.
cd "$(dirname "$0")"
arm=$1; ex=$2; i=$3
out=$arm-$i.yaml
sh ../codex-writer-ex.sh "$ex" ../human/task-write.md gpt-6-luna "$out"
cur=$out
for r in 1 2 3; do
  err=$(bun check.ts "$cur")
  echo "$cur: $err" >> $arm.txt
  [ "$err" = ok ] && exit 0
  nxt=$arm-$i-f$r.yaml
  sh ../codex-fix-ex.sh "$ex" ../human/task-write.md "$cur" "$err" gpt-6-luna "$nxt"
  cur=$nxt
done
echo "$cur: $(bun check.ts "$cur")" >> $arm.txt
