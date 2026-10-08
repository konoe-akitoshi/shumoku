#!/bin/sh
# Usage: run-t.sh <arm> <types.ts> <n>  — a types writer (no example) with up to 3 fix rounds.
cd "$(dirname "$0")"; CHECK=check-speed.ts
arm=$1; types=$2; i=$3
out=$arm-$i.yaml
sh ../codex-writer.sh "$types" ../task-r23.md gpt-6-luna "$out"
cur=$out
for r in 1 2 3; do
  err=$(bun $CHECK "$cur")
  echo "$cur: $err" >> $arm.txt
  [ "$err" = ok ] && exit 0
  nxt=$arm-$i-f$r.yaml
  sh ../codex-fix.sh "$types" ../task-r23.md "$cur" "$err" gpt-6-luna "$nxt"
  cur=$nxt
done
echo "$cur: $(bun $CHECK "$cur")" >> $arm.txt
