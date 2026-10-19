# Project file (`.neted.zip`, format v5)

A neted project is a single zip archive carrying everything the
editor needs to reopen the project — diagram, products (catalog),
scenes, and the binary assets (floor-plan images, raster icons)
that those structures reference. JSON-only `.neted.json` (v3) is
gone; legacy files are not read.

## Layout

```
manifest.json     entry point — { format, version, name, settings, sceneIds }
network.yaml      the configuration, as the network YAML writes it (the same file the CLI reads)
layers.json       its observation, design and drawing layers, keyed by the configuration's ids
products.json     Product[] (catalog) — sorted in load order
scenes/
  <sceneId>.json  one Scene per file
assets/
  <hash>.<ext>    content-addressed binary blobs
```

Why split:

- **network.yaml** is the project's configuration in the network YAML, so a person can
  read and diff it, and the CLI can draw it as is. Nodes / links / groups are tightly
  id-coupled, so it is one file.
- **layers.json** carries what the configuration doesn't say, layer by layer: the design
  layer (catalog products and their port lists, the product snapshot `spec`, cable medium and
  grade, the plug at each link end, cable runs `via` / `bends`, terminations) and the drawing
  layer (node position, display size, shape, styles, icon, port placement, link label / type /
  arrow, group direction / style / sheet, root `GraphSettings`). Moving or restyling leaves
  `network.yaml` unchanged.
  The editor and renderer consume the `NetworkGraph` drawn from both (`toNetworkGraph`); on
  save it is split back (`fromNetworkGraph`). Group bounds follow from positioned nodes and
  are never persisted; loading regenerates them without moving saved nodes.
- **products.json** is a single file. Products diff cleanly inside
  one JSON when sorted by id; the per-file alternative just adds
  an index-sync failure mode.
- **scenes/** is split per scene. Each scene corresponds to one
  floor / room edit and is the natural unit of human review — a
  PR that touches Floor 2 should not noise up Floor 1's diff.
- **assets/** is content-addressed. Same image referenced from
  multiple scenes / products is stored once, and the hash is the
  filename so reads do not need a separate lookup table.

## Asset references

Inside the zip, image-bearing fields hold an
`asset:<hash>.<ext>` URI:

```
Scene.background.src       "asset:1f2a…3b.png"
Product.icon               "asset:7c4e…01.jpg"  (raster only — SVG stays inline)
Node.spec.icon             "asset:7c4e…01.jpg"  (snapshot from Product)
```

`<hash>` is the first 16 hex chars (64 bits) of the SHA-256 of the
asset's bytes. That is more than enough collision resistance for
a single project's worth of images and short enough to keep
filenames pleasant.

`asset:` lives in **two storage tiers** but never in memory: the
zip file and IndexedDB documents both carry `asset:<hash>` strings;
state in the editor always holds runtime URLs (`blob:`,
`http(s):`, or inline SVG text).

- `serializeEntity(value)` — walks the value, replacing `blob:`
  URLs with `asset:` refs. Used by both the zip writer and the
  IDB document store before persisting.
- `rehydrateEntity(value)` — inverse. Used by both the zip reader
  and the IDB load path so render code only ever sees blob URLs.

Render paths never see the `asset:` scheme, so adding the format
did not require touching `classifyIcon` / `resolveIcon` / `<img>`
consumers.

## AssetStore

`apps/editor/src/lib/state/assets.svelte.ts` is the in-memory
session store:

- `put(blob)` — hashes, registers, returns `{ hash, ext, blob, url }`
- `putUserImage(file)` — SVG → text (no asset), raster → `put`
- `putWithHash(hash, ext, blob)` — used by the reader
- `byUrl(url)` / `byHash(hash)` — lookups
- `reset()` — revokes every blob URL; called when the active
  project changes

The store is **session-scoped**, not project-scoped per se —
mid-session, undoing a "set background" leaves the previous blob
addressable so redo works. Orphaned entries are not GC'd
mid-session; the writer simply walks live state for `asset:` refs
and writes only those. The durable copies of the asset bytes live
in IDB rows under `[projectId, hash]` (see `local-cache.md`); the
AssetStore is just a runtime cache.

## Writer / reader

Both live under `apps/editor/src/lib/persistence/`:

- `writer.ts` — `writeProjectZip({ name, model, products,
  scenes, resolveAsset? })` → `Blob`. Runs `serializeEntity` on
  each top-level slice (idempotent for already-`asset:` refs),
  writes the model's configuration as `network.yaml` and its layers
  as `layers.json`, collects referenced hashes, and packs everything via
  `fflate.zipSync`. The `resolveAsset` callback feeds asset
  bytes; defaults to the in-memory `AssetStore`. The DB-canonical
  export path passes a resolver built from per-project asset
  rows in IDB so the zip reflects what's actually persisted.
- `reader.ts` — `readProjectZip(blob | bytes)` → `NetedProject`.
  Two passes: register every `assets/<hash>.<ext>` into the
  AssetStore first so refs can resolve, then parse JSON and run
  `rehydrateEntity` on each tree, replacing `asset:` strings with
  the live blob URL. Returns the network model; a v4 archive's graph is
  turned into one with `fromNetworkGraph`.

The core presentation validator checks finite coordinates, positive sizes,
supported shapes, numeric style/settings limits, duplicate IDs, stale entity/owned-port references
and presentation leaking into topology. Styled links require stable IDs.
It does not validate the entire topology model.

## Where the zip comes from

Export is **DB-driven**. `exportProjectZip(name?)`:

1. `cache.drain()` — make sure any pending sync has landed so the
   DB reflects the latest state.
2. `projectsDb.loadSnapshot(id)` + `projectsDb.getAssets(id)` —
   read the canonical rows + per-project asset blobs.
3. Build a per-export `resolveAsset` from the asset rows.
4. `writeProjectZip(...)` with the loaded data.

This makes "what's in the .neted.zip" identical to "what loads on
reload". The in-memory state is a working copy; the DB and the
zip are both projections of the canonical store.

Sample (read-only) is the only exception: it's never cached, so
its export still falls back to in-memory state.

## Boundary contract

Three input sites convert user image uploads via
`assetStore.putUserImage`:

- `SceneSideToolbar` (background image)
- `materials/+page.svelte` (custom icon during product creation)
- `materials/[productId]/+page.svelte` (icon edit)

After this contract: `data:` URLs never enter editor state. SVG
stays as inline text (small + diagram-friendly snapshot model);
everything else flows through the AssetStore.

## Format versioning

`manifest.json` carries `{ format: "neted", version: 5 }`. A v5 archive requires
`network.yaml` and `layers.json`. A v4 archive (`diagram.json` + `presentation.json`) is
still read and is written back as v5 on the next export, so saved projects carry over. The
reader rejects v1/v2/v3 with a clear message.

IndexedDB is separately versioned: DB v7 keeps one document per project (the network
model, products and scenes); projects cached one row per entity (v2–v6) move into their
document when next opened. See `local-cache.md`. Archive,
database, core NetworkDocument (`schemaVersion: '3'`) and package versions
are separate contracts.
