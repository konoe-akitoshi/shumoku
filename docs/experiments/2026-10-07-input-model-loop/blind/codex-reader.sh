#!/bin/sh
# Usage: codex-reader.sh <types.ts> <network.yaml> <questions.md> <model> <out.md>
# Runs one blind reader on Codex with the three files in the prompt, so it opens nothing else.
{
  printf 'You are testing a data format. The format is given as TypeScript types; the file is YAML of type Network.\n\n<types>\n'
  cat "$1"
  printf '</types>\n\n<file>\n'
  cat "$2"
  printf '</file>\n\n'
  cat "$3"
} | codex exec -s read-only --ephemeral --skip-git-repo-check --ignore-user-config -C "$(dirname "$0")" \
    -m "$4" -c model_reasoning_effort="\"${EFFORT:-low}\"" -o "$5" - > "$5.log" 2>&1
