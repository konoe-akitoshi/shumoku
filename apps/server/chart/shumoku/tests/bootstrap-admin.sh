#!/usr/bin/env bash
set -euo pipefail
chart=$(cd "$(dirname "$0")/.." && pwd)
render() { helm template test "$chart" "$@"; }
# All values below are public test fixtures, never production passwords.
default=$(render)
! grep -q 'kind: Secret' <<< "$default"
! grep -q 'SHUMOKU_BOOTSTRAP_ADMIN_PASSWORD_FILE' <<< "$default"
existing=$(render --set auth.existingSecret=external-admin)
! grep -q 'kind: Secret' <<< "$existing"
grep -q 'secretName: "external-admin"' <<< "$existing"
grep -q 'SHUMOKU_BOOTSTRAP_ADMIN_PASSWORD_FILE' <<< "$existing"
managed=$(render --set-string auth.bootstrapAdminPassword=fixture-password --set auth.passwordKey=custom-key)
grep -q 'kind: Secret' <<< "$managed"
grep -q 'name: test-shumoku-bootstrap-admin' <<< "$managed"
grep -q 'secretName: "test-shumoku-bootstrap-admin"' <<< "$managed"
grep -q '"custom-key": "Zml4dHVyZS1wYXNzd29yZA=="' <<< "$managed"
grep -q 'key: custom-key' <<< "$managed"
grep -q 'SHUMOKU_BOOTSTRAP_ADMIN_PASSWORD_FILE' <<< "$managed"
! grep -q 'fixture-password' <<< "$managed"
long=$(render --set-string auth.bootstrapAdminPassword=fixture-password --set fullnameOverride=abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijk)
grep -q 'secretName: "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstu-bootstrap-admin"' <<< "$long"
expect_failure() {
  local message=$1; shift
  local output
  if output=$(render "$@" 2>&1); then
    echo 'Expected helm template to fail' >&2; exit 1
  fi
  grep -q "$message" <<< "$output"
}
expect_failure 'Set only one' --set auth.existingSecret=external-admin --set-string auth.bootstrapAdminPassword=fixture-password
expect_failure 'at least 8' --set-string auth.bootstrapAdminPassword=short
expect_failure 'must be a string' --set auth.bootstrapAdminPassword=12345678
expect_failure 'must not be empty' --set-string auth.bootstrapAdminPassword=fixture-password --set auth.passwordKey=
echo 'Bootstrap administrator rendering checks passed'
