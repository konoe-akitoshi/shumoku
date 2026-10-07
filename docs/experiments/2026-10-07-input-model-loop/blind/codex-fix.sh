#!/bin/sh
# Usage: codex-fix.sh <types.ts> <task.md> <in.yaml> <error> <model> <out.yaml>
# Gives a writer its parser error once, as a person running the validator would see it.
{
  printf 'You wrote the YAML below for the description, in the format given as TypeScript types. The validator rejected it with this error:\n\n%s\n\nFix the YAML so it passes, changing only what the error needs. Reply with the whole corrected YAML in one ```yaml block.\n\n<types>\n' "$4"
  cat "$1"; printf '</types>\n<description>\n'; cat "$2"; printf '</description>\n<yaml>\n'; cat "$3"; printf '</yaml>\n'
} | codex exec -s read-only --ephemeral --skip-git-repo-check --ignore-user-config -C "$(dirname "$0")" \
    -m "$5" -c model_reasoning_effort='"low"' -o "$6.md" - > "$6.log" 2>&1
awk '/^```yaml/{f=1;next} /^```/{if(f){exit}} f' "$6.md" > "$6"
