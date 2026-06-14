# Releasing Shumoku

Shumoku has independent release streams. A version belongs to one product or
package; there is no monorepo-wide Shumoku version.

| Stream | Source of truth | Stable | Beta |
|--------|-----------------|--------|------|
| npm libraries and CLI | each `package.json` | npm `latest` | npm `beta` snapshot |
| Server | `apps/server/package.json` | `server-vX.Y.Z` | `server-vX.Y.Z-beta.N` |
| Editor | `apps/editor/package.json` | Vercel Production + `editor-vX.Y.Z` | Vercel Preview + `editor-vX.Y.Z-beta.N` |
| Docs | deployed from `main` | no product version | pull-request preview |

## npm Libraries And CLI

Public libraries and `@shumoku/cli` use independent versions managed by
Changesets:

```bash
bun run changeset
```

Merging the Changesets release PR publishes affected packages under npm's
`latest` dist-tag. Package-specific Git tags such as
`@shumoku/core@0.2.24` are created, but npm releases do not create GitHub
Releases.

The CLI is installed independently from the `shumoku` library:

```bash
npx @shumoku/cli render network.yaml -o network.svg
```

### npm Beta

Run the **Release npm Beta** workflow manually on a branch that contains
changeset files. It creates ephemeral versions such as
`0.0.0-beta-20260614123000` and publishes only the affected packages under the
`beta` dist-tag:

```bash
npm install @shumoku/core@beta
npx @shumoku/cli@beta render network.yaml -o network.svg
```

Snapshot versions are never committed and never update npm's `latest` tag.

## Product Version Command

Server and Editor versions may be stable or numbered beta versions:

```bash
bun run version:server 0.2.0-beta.1
bun run version:editor 0.2.0-beta.1
bun run version:products:check
```

The Server command also synchronizes the Helm chart. Both commands synchronize
the corresponding workspace entry in `bun.lock`. API and web implementation
workspaces remain at `0.0.0`.

## Shumoku Server

Server release tags are product-qualified:

```bash
# Beta
bun run version:server 0.2.0-beta.1
git add apps/server/package.json apps/server/chart/shumoku/Chart.yaml bun.lock
git commit -m "chore(server): release 0.2.0-beta.1"
git tag -a server-v0.2.0-beta.1 -m "Shumoku Server 0.2.0-beta.1"
git push origin HEAD server-v0.2.0-beta.1

# Stable
bun run version:server 0.2.0
git add apps/server/package.json apps/server/chart/shumoku/Chart.yaml bun.lock
git commit -m "chore(server): release 0.2.0"
git tag -a server-v0.2.0 -m "Shumoku Server 0.2.0"
git push origin HEAD server-v0.2.0
```

The Docker workflow verifies that the tag matches
`apps/server/package.json`.

| Release | GHCR tags changed | GitHub Release |
|---------|-------------------|----------------|
| Beta | `X.Y.Z-beta.N`, `beta` | prerelease |
| Stable | `X.Y.Z`, `latest` | stable release |

Pushes to `main` and pull requests build the image for verification but do not
publish it. Stable releases never move `beta`, and beta releases never move
`latest`.

The running Server checks GitHub Releases whose tags begin with `server-v`.
Stable builds ignore beta releases. Beta builds can report a newer beta or the
eventual stable release.

### Test A Server Beta

Use a separate data volume because database migrations may make downgrade
testing unsafe:

```bash
docker run -d --name shumoku-beta -p 8081:8080 \
  -v shumoku-beta-data:/data \
  ghcr.io/konoe-akitoshi/shumoku:beta
```

For a reproducible test, replace `beta` with the immutable
`X.Y.Z-beta.N` tag.

## Shumoku Editor

The Editor is deployed by Vercel's Git integration. Branch pushes and pull
requests create Preview deployments; merging to `main` creates a Production
deployment at [editor.shumoku.dev](https://editor.shumoku.dev/).

### Test An Editor Beta

Create a branch, set a numbered beta version, and push it:

```bash
git switch -c release/editor-0.2.0-beta.1
bun run version:editor 0.2.0-beta.1
git add apps/editor/package.json bun.lock
git commit -m "chore(editor): release 0.2.0-beta.1"
git push -u origin HEAD
```

Vercel adds the Preview URL to the commit and pull request. The Preview origin
has separate IndexedDB storage from Production, which keeps beta projects
isolated. After the Preview has passed testing, optionally record that exact
commit as a prerelease:

```bash
git tag -a editor-v0.2.0-beta.1 -m "Shumoku Editor 0.2.0-beta.1"
git push origin editor-v0.2.0-beta.1
```

The tag creates a GitHub prerelease. It does not trigger a second Vercel
deployment.

### Release The Editor

Change the version to stable in the same release pull request:

```bash
bun run version:editor 0.2.0
git add apps/editor/package.json bun.lock
git commit -m "chore(editor): release 0.2.0"
git push
```

Merge only after the Vercel Preview and repository checks pass. Vercel deploys
the merge commit to Production. After the Production deployment succeeds, tag
that exact commit:

```bash
git switch main
git pull --ff-only
git tag -a editor-v0.2.0 -m "Shumoku Editor 0.2.0"
git push origin editor-v0.2.0
```

The tag creates the stable GitHub Release and provides an immutable source
reference for the Vercel deployment. The Editor home screen derives its channel
and commit from Vercel's system environment variables. Keep **Automatically
expose System Environment Variables** enabled in the Vercel project settings.

## Deployment Updates

Production should pin immutable tags:

```bash
SHUMOKU_VERSION=0.2.0 docker compose up -d

helm upgrade shumoku apps/server/chart/shumoku \
  --set image.tag=0.2.0
```

The Server Settings page reports its running version, commit, build timestamp,
latest relevant release, and deployment-specific update guidance. Update checks
are cached for six hours. Set `SHUMOKU_UPDATE_CHECK=off` for offline
installations.
