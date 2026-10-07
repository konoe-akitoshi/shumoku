#!/bin/sh
# Usage: codex-grade.sh <key.md> <answers.md>  -> prints one line per question: "Qn ok|wrong"
# Grades one reader's answers against the key with a strong model, so the loop reads totals only.
{
  printf 'Grade the answers against the key. A "cannot tell" in the key needs "cannot tell" or an equivalent ("unknown", "not stated"). Wording does not matter, only the fact. Parenthetical details in the key (in brackets or after a colon) need not be stated; grade the main answer. Reply with exactly one line per question, "Q<n> ok" or "Q<n> wrong", and nothing else.\n\n<key>\n'
  cat "$1"
  printf '</key>\n\n<answers>\n'
  cat "$2"
  printf '</answers>\n'
} | codex exec -s read-only --ephemeral --skip-git-repo-check --ignore-user-config -C "$(dirname "$0")" \
    -m gpt-6.1-sol -c model_reasoning_effort='"low"' -o "$2.grade" - > /dev/null 2>&1
cat "$2.grade"
