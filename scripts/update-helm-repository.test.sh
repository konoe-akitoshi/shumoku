#!/usr/bin/env bash
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
fixture=$(mktemp -d)
trap 'rm -rf "$fixture"' EXIT
mkdir -p "$fixture/chart" "$fixture/archives" "$fixture/conflict"
for version in 1.0.0 1.0.1; do
  printf 'apiVersion: v2\nname: shumoku\nversion: %s\n' "$version" > "$fixture/chart/Chart.yaml"
  helm package "$fixture/chart" --destination "$fixture/archives" > /dev/null
  bash "$root/scripts/update-helm-repository.sh" "$fixture/archives/shumoku-$version.tgz" \
    "$fixture/repo" https://example.com/charts
done
# Both versions remain downloadable and present in the index.
for version in 1.0.0 1.0.1; do
  test -f "$fixture/repo/shumoku-$version.tgz"
  grep -q "https://example.com/charts/shumoku-$version.tgz" "$fixture/repo/index.yaml"
done
cp "$fixture/repo/index.yaml" "$fixture/index-before.yaml"
bash "$root/scripts/update-helm-repository.sh" "$fixture/archives/shumoku-1.0.1.tgz" \
  "$fixture/repo" https://example.com/charts
cmp "$fixture/index-before.yaml" "$fixture/repo/index.yaml"
# A valid but different archive at the same version must not replace the release.
printf 'description: different contents\n' >> "$fixture/chart/Chart.yaml"
helm package "$fixture/chart" --destination "$fixture/conflict" > /dev/null
if bash "$root/scripts/update-helm-repository.sh" "$fixture/conflict/shumoku-1.0.1.tgz" \
  "$fixture/repo" https://example.com/charts; then
  echo 'Unexpectedly replaced a published chart' >&2
  exit 1
fi
cmp "$fixture/archives/shumoku-1.0.1.tgz" "$fixture/repo/shumoku-1.0.1.tgz"
cmp "$fixture/index-before.yaml" "$fixture/repo/index.yaml"
echo ok
