#!/usr/bin/env bash
# Generate GitHub Release notes for a Shumoku product release.
#
#   scripts/release-notes.sh <server|editor> <tag>
#
# App-level changes only (path-scoped, grouped by Conventional Commit type via
# git-cliff). npm library changes are NOT re-listed here — they ship with their
# own Changesets CHANGELOGs; this just records which library versions the build
# bundles. Requires: git (full history + tags), bunx.
set -euo pipefail

product="${1:?usage: release-notes.sh <server|editor> <tag>}"
tag="${2:?usage: release-notes.sh <server|editor> <tag>}"
repo="${GH_REPO:-konoe-akitoshi/shumoku}"
cliff_version="git-cliff@2.13.1"

case "$product" in
  server)
    title="Shumoku Server"
    scope='apps/server/**'
    prefix='server-v'
    version="${tag#server-v}"
    header=$(cat <<EOF
**${title} ${version}**

\`\`\`bash
docker run -d -p 8080:8080 -v shumoku-data:/data ghcr.io/${repo}:${version}
\`\`\`

Image: \`ghcr.io/${repo}:${version}\` · \`:latest\`
EOF
)
    ;;
  editor)
    title="Shumoku Editor"
    scope='apps/editor/**'
    prefix='editor-v'
    version="${tag#editor-v}"
    header=$(cat <<EOF
**${title} ${version}** — https://editor.shumoku.dev/ (deployed from this commit)
EOF
)
    ;;
  *)
    echo "unknown product: $product" >&2; exit 1 ;;
esac

# App-level changelog, scoped to the product's own paths.
changes="$(bunx "$cliff_version" --config .github/cliff.toml \
  --include-path "$scope" --tag-pattern "${prefix}[0-9].*" \
  --latest --strip all 2>/dev/null || true)"
[ -z "${changes//[$'\n\r\t ']/}" ] && changes="_No app-level changes in this release._"

# Library versions bundled in this build (scoped @shumoku/* public packages).
bundled="$(
  for pj in libs/@shumoku/*/package.json; do
    bun -e 'const p=JSON.parse(await Bun.file(process.argv[1]).text());
      if(p.name?.startsWith("@shumoku/") && !p.private && p.version) console.log(`${p.name}@${p.version}`)' "$pj" 2>/dev/null
  done | sort | sed 's/^/- `/; s/$/`/'
)"

# Compare link to the previous release of the same product (omitted on first release).
prev="$(git tag -l "${prefix}*" --sort=-version:refname | grep -A1 -xF "$tag" | tail -1 || true)"
compare=""
[ -n "$prev" ] && [ "$prev" != "$tag" ] && \
  compare="**Full changelog:** https://github.com/${repo}/compare/${prev}...${tag}"

printf '%s\n\n## Changes\n%s\n' "$header" "$changes"
[ -n "$bundled" ] && printf '\n## Bundled libraries\n%s\n' "$bundled"
[ -n "$compare" ] && printf '\n%s\n' "$compare"
