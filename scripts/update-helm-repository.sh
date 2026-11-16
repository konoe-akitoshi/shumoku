#!/usr/bin/env bash
# Add an immutable chart archive to an HTTP repository, retaining older versions.
set -euo pipefail
archive=${1:?usage: update-helm-repository.sh ARCHIVE DIRECTORY URL}
destination=${2:?repository directory is required}
url=${3:?public repository URL is required}
filename=$(basename "$archive")
[[ "$filename" == shumoku-*.tgz ]] || { echo 'Expected a shumoku chart archive' >&2; exit 1; }
helm show chart "$archive" > /dev/null
mkdir -p "$destination"
if [[ -f "$destination/$filename" ]]; then
  cmp "$archive" "$destination/$filename" || { echo 'Refusing to replace a published chart' >&2; exit 1; }
  # Leave timestamps and the index untouched when replaying a successful release.
  [[ ! -f "$destination/index.yaml" ]] || exit 0
else
  cp "$archive" "$destination/$filename"
fi
helm repo index "$destination" --url "$url"
