<script lang="ts">
  import { diagramState, editorState } from '$lib/context.svelte'
  import { assetStore } from '$lib/state/assets.svelte'
  import { sessionStore } from '$lib/state/session.svelte'
  import { productLabel } from '$lib/types'
  import { mapAuthoring as authoring } from './authoring.svelte'

  let existing = $state('')
  let productId = $state('')
  let legacyChoice = $state('')
  const legacyPlacements = $derived(
    (diagramState.mapWorkspace?.map?.legacyScenes ?? []).flatMap((scene) => {
      const drawing = diagramState.mapWorkspace?.map?.drawings.find(
        (d) => d.id === `drawing:${scene.id}`,
      )
      if (!drawing) return []
      return scene.nodePlacements
        .filter((p) => diagramState.nodes.has(p.nodeId))
        .map((p) => ({
          key: `${scene.id}/${p.nodeId}`,
          nodeId: p.nodeId,
          label: `${scene.name} · ${p.nodeId}`,
          position: {
            x: drawing.position.x + p.position.x * drawing.scale,
            y: drawing.position.y + p.position.y * drawing.scale,
          },
        }))
    }),
  )
  function toggleEditing() {
    authoring.previewDrawingIds = []
    authoring.placement = null
    authoring.calibration = null
    editorState.setMapMode(editorState.interactive ? 'view' : 'edit')
  }
  function restorePlacement() {
    const candidate = legacyPlacements.find((p) => p.key === legacyChoice)
    if (candidate) diagramState.placeMapPoint(candidate.nodeId, candidate.position)
  }

  let error = $state('')
  let uploading = $state(false)
  const unplaced = $derived(
    [...diagramState.nodes.values()].filter(
      (n) => !diagramState.mapWorkspace?.nodePlacements.some((p) => p.nodeId === n.id),
    ),
  )
  const products = $derived(diagramState.products.filter((p) => p.kind === 'device'))
  function arm(placement: typeof authoring.placement) {
    authoring.previewDrawingIds = []
    authoring.calibration = null
    authoring.placement = placement
  }
  async function upload(event: Event) {
    const input = event.target as HTMLInputElement
    const files = [...(input.files ?? [])]
    const projectId = sessionStore.projectId
    uploading = true
    error = ''
    try {
      for (const file of files) {
        const src = await assetStore.putUserImage(file)
        const img = new Image()
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve()
          img.onerror = () => reject(new Error(`Cannot load ${file.name}`))
          img.src = src
        })
        if (sessionStore.projectId !== projectId) return
        diagramState.addMapDrawing({
          src,
          width: img.naturalWidth,
          height: img.naturalHeight,
          name: file.name,
        })
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Image upload failed'
    } finally {
      uploading = false
      input.value = ''
    }
  }
</script>
<div
  data-print-hide
  class="pointer-events-auto flex max-w-[min(900px,90vw)] flex-wrap items-center gap-2 rounded-xl border border-neutral-200 bg-white/95 p-2 text-xs text-neutral-800 shadow-lg dark:border-neutral-700 dark:bg-neutral-800/95 dark:text-neutral-100"
>
  <button type="button" class="rounded border px-2 py-1" onclick={toggleEditing}>
    {editorState.interactive ? 'View mode' : 'Edit mode'}
  </button>
  {#if editorState.interactive}
    <label class="cursor-pointer rounded border px-2 py-1"
      >{uploading ? 'Loading…' : 'Add images'}
      <input
        aria-label="Add drawing images"
        type="file"
        accept="image/*"
        multiple
        class="sr-only"
        disabled={uploading}
        onchange={upload}
      ></label
    >
    <select
      aria-label="Unplaced devices"
      class="max-w-40 rounded border bg-transparent p-1"
      bind:value={existing}
    >
      <option value="">Unplaced ({unplaced.length})</option>
      {#each unplaced as n (n.id)}
        <option value={n.id}>
          {Array.isArray(n.label) ? n.label.join(' ') : (n.label ?? n.id)}
        </option>
      {/each}
    </select>
    <button
      type="button"
      class="rounded border px-2 py-1 disabled:opacity-40"
      disabled={!existing || !unplaced.some((n) => n.id === existing)}
      onclick={() => arm({ kind: 'existing', nodeId: existing })}
    >
      Place
    </button>
    <button type="button" class="rounded border px-2 py-1" onclick={() => arm({ kind: 'empty' })}>
      New device
    </button>
    {#if products.length}
      <select
        aria-label="Product to place"
        class="max-w-40 rounded border bg-transparent p-1"
        bind:value={productId}
      >
        <option value="">Products</option>
        {#each products as p (p.id)}
          <option value={p.id}>{productLabel(p)}</option>
        {/each}
      </select>
      <button
        type="button"
        class="rounded border px-2 py-1 disabled:opacity-40"
        disabled={!productId}
        onclick={() => arm({ kind: 'product', productId })}
      >
        Add product
      </button>
    {/if}
    {#each ['outlet', 'eps', 'panel'] as role}
      <button
        type="button"
        class="rounded border px-2 py-1"
        onclick={() => arm({ kind: 'termination', role: role as 'outlet' | 'eps' | 'panel' })}
      >
        {role === 'eps' ? 'EPS' : role === 'outlet' ? 'Outlet' : 'Panel'}
      </button>
    {/each}
  {/if}
  {#if editorState.interactive && legacyPlacements.length > 0}
    <details class="relative">
      <summary class="cursor-pointer rounded border px-2 py-1">Imported placements</summary>
      <div
        class="absolute bottom-10 left-0 z-30 w-72 rounded-lg border bg-white p-3 shadow-lg dark:bg-neutral-800"
      >
        <p class="mb-2">
          Original placements are preserved. Choose an alternative to move the existing device.
        </p>
        <select
          aria-label="Original placement"
          bind:value={legacyChoice}
          class="mb-2 w-full rounded border bg-transparent p-1"
        >
          <option value="">Choose placement</option>
          {#each legacyPlacements as placement (placement.key)}
            <option value={placement.key}>{placement.label}</option>
          {/each}
        </select>
        <button
          type="button"
          class="rounded border px-2 py-1 disabled:opacity-40"
          disabled={!legacyChoice}
          onclick={restorePlacement}
        >
          Use this placement
        </button>
      </div>
    </details>
  {/if}
  {#if error}
    <span role="alert" class="text-red-600">{error}</span>
  {/if}
</div>
