#!/bin/sh
# Usage: codex-grade-write.sh <key.md> <task.md> <written.yaml>  -> one line per key item
{
  printf 'Grade the YAML against the key. The YAML was written for the description in a network format. For each numbered item of the key, decide whether the YAML states that fact (wording and ids do not matter). Reply with exactly one line per item, "<n> ok" or "<n> wrong: <few words>", and nothing else.\n\n<key>\n'
  cat "$1"; printf '</key>\n<description>\n'; cat "$2"; printf '</description>\n<yaml>\n'; cat "$3"; printf '</yaml>\n'
} | codex exec -s read-only --ephemeral --skip-git-repo-check --ignore-user-config -C "$(dirname "$0")" \
    -m gpt-6.1-sol -c model_reasoning_effort='"low"' -o "$3.grade" - > /dev/null 2>&1
cat "$3.grade"
