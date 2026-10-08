#!/bin/sh
# Usage: codex-writer-ex.sh <example.yaml> <task.md> <model> <out.yaml>
# Like codex-writer.sh, but the writer sees one example file instead of the types.
ex=$1; task=$2; model=$3; out=$4
dir=$(dirname "$0")
{
  printf 'You are testing a data format for network diagrams. You get one example file in the format and nothing else.\n\n<example>\n'
  cat "$ex"
  printf '</example>\n\n<description>\n'
  cat "$task"
  printf '</description>\n\nWrite the network described as YAML in this format. Write what the description says, as the format intends. Reply with the YAML in one ```yaml block, then: (1) anything in the description you could not express, (2) anything you had to guess or add that the description did not say, (3) anything in the format you found unclear.\n'
} | codex exec -s read-only --ephemeral --skip-git-repo-check --ignore-user-config -C "$dir" -m "$model" \
    -c model_reasoning_effort='"low"' -o "$out.md" - > "$out.log" 2>&1
awk '/^```yaml/{f=1;next} /^```/{if(f){exit}} f' "$out.md" > "$out"
