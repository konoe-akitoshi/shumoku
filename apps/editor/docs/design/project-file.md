# Project file (`.neted`, format v1)

A neted project is a single zip archive carrying everything the
editor needs to reopen the project — diagram, products (catalog),
scenes, and the binary assets (floor-plan images, raster icons)
that those structures reference. JSON-only `.neted.json` (v3) is
gone; legacy files are not read.

## Layout

```
manifest.json     entry point — { format, version, name, settings, sceneIds }
diagram.json      NetworkGraph (nodes / links / subgraphs)
products.json     Product[] (catalog) — sorted in load order
scenes/
  <sceneId>.json  one Scene per file
assets/
  <hash>.<ext>    content-addressed binary blobs
```

Why split:

- **diagram.json** is a single file because nodes / links /
  subgraphs are tightly id-coupled; splitting hurts more than it
  helps.
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

`asset:` lives **only** in serialized form. In memory, the same
fields hold runtime URLs (`blob:`, `http(s):`, or inline SVG
text). The reader rewrites `asset:` → blob URL on load; the
writer rewrites blob URL → `asset:` on save. Render paths never
see the `asset:` scheme, so adding the format did not require
touching `classifyIcon` / `resolveIcon` / `<img>` consumers.

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
and writes only those.

## Writer / reader

Both live under `apps/editor/src/lib/persistence/`:

- `writer.ts` — `writeProjectZip({ name, diagram, products, scenes })`
  → `Blob`. Walks each top-level slice, replaces blob URLs with
  `asset:` refs (`toSerializedRef`), collects referenced hashes,
  and packs everything via `fflate.zipSync`.
- `reader.ts` — `readProjectZip(blob | bytes)` → `NetedProject`.
  Two passes: register every `assets/<hash>.<ext>` first so refs
  can resolve, then parse JSON and `rehydrateRefs` walks each
  parsed tree replacing `asset:` strings with the live blob URL.

Both pieces deliberately stay thin (~120 lines each) and the
serializer functions are per-slice so the JSON shape stays
checked by the existing `NetedProject` types.

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

`manifest.json` carries `{ format: "neted", version: 1 }`. The
reader rejects anything else with a clear message. Bumps:

- **patch / minor**: in-place fixes that the v1 reader still
  parses — keep version at 1.
- **major**: breaking layout change — bump to 2 and write a new
  reader branch. We do not carry old readers; `.neted` is not a
  long-term archival format.
