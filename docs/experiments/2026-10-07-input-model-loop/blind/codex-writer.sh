#!/bin/sh
# Usage: writer.sh <types.ts> <task.md> <model> <out.yaml>
# Runs one blind writer on Codex: the two files go in the prompt, so it opens nothing else.
types=$1; task=$2; model=$3; out=$4
dir=$(dirname "$0")
{
  printf 'You are testing a data format. The format is given as TypeScript types; the input is YAML of type Network.\n\n<types>\n'
  cat "$types"
  printf '</types>\n\n<description>\n'
  cat "$task"
  printf '</description>\n\nWrite the network described as YAML in this format. Write what the description says, as the format intends. Reply with the YAML in one ```yaml block, then: (1) anything in the description you could not express, (2) anything you had to guess or add that the description did not say, (3) anything in the format you found unclear.\n'
} | codex exec -s read-only --ephemeral --skip-git-repo-check --ignore-user-config -C "$dir" -m "$model" \
    -c model_reasoning_effort='"low"' -o "$out.md" - > "$out.log" 2>&1
# Pull the YAML block out of the reply.
awk '/^```yaml/{f=1;next} /^```/{if(f){exit}} f' "$out.md" > "$out"
