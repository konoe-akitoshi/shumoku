<script lang="ts">
  import { Dialog } from 'bits-ui'
  import { CaretDown, Plus, X } from 'phosphor-svelte'
  import { untrack } from 'svelte'
  import { diagramState } from '$lib/context.svelte'
  import {
    autoOutletPosition,
    autoOutletTag,
    buildViaForLink,
    findAutoOutlet,
  } from '$lib/scene/auto-outlets'
  import { descendantSubgraphIds } from '$lib/scene/scope'

  // Per-EPS routing modal. Progressive: shows only the nodes the user
  // has chosen to inspect (or that already have wires through this
  // EPS). For each visible node, lists its wires as opt-in checkboxes
  // — default off; the user explicitly checks the wires that should
  // ride this chase.

  let {
    epsId = null,
    sceneId,
    onclose,
  }: {
    epsId: string | null
    sceneId: string
    onclose: () => void
  } = $props()

  const eps = $derived(epsId ? (diagramState.nodes.get(epsId) ?? null) : null)
  const epsLabel = $derived.by(() => {
    if (!eps) return ''
    const l = eps.label
    return Array.isArray(l) ? l[0] : (l ?? eps.id)
  })

  // Devices in the EPS's scope that could plausibly send wires through
  // this chase. We exclude TPs (they're passive transit, not sources).
  const candidateNodes = $derived.by(() => {
    if (!eps) return []
    const scopeIds = eps.parent ? descendantSubgraphIds(diagramState.subgraphs, eps.parent) : null
    return [...diagramState.nodes.values()].filter((n) => {
      if (n.id === epsId) return false
      if (n.termination) return false
      if (scopeIds === null) return !n.parent
      return !!n.parent && scopeIds.has(n.parent)
    })
  })

  function nodeLabelOf(id: string): string {
    const n = diagramState.nodes.get(id)
    if (!n) return id
    const l = n.label
    return Array.isArray(l) ? l[0] : (l ?? id)
  }

  // Wires touching a given node (only id-bearing).
  function wiresFor(nid: string) {
    return diagramState.links.filter((l) => !!l.id && (l.from.node === nid || l.to.node === nid))
  }
  function farEndOf(linkId: string, anchorNodeId: string): string {
    const l = diagramState.links.find((x) => x.id === linkId)
    if (!l) return ''
    return l.from.node === anchorNodeId ? l.to.node : l.from.node
  }

  // visibleNodes: which devices' sections are shown in the modal
  // body. routing: per-wire opt-in toggle.
  let visibleNodes = $state<string[]>([])
  let routing = $state<Record<string, boolean>>({})

  // Seed once per modal open. Pre-expand devices that already have
  // wires routed through this EPS so existing routing is editable
  // without the user having to re-discover it.
  $effect(() => {
    const id = epsId
    if (!id) return
    untrack(() => {
      const expanded = new Set<string>()
      const seedRouting: Record<string, boolean> = {}
      for (const n of candidateNodes) {
        for (const w of wiresFor(n.id)) {
          if (!w.id) continue
          const isRouted = (w.via ?? []).includes(id)
          if (isRouted) {
            expanded.add(n.id)
            seedRouting[w.id] = true
          }
        }
      }
      visibleNodes = [...expanded]
      routing = seedRouting
    })
  })

  function addNode(nid: string) {
    if (!visibleNodes.includes(nid)) visibleNodes = [...visibleNodes, nid]
    // Seed entries for any wires of this node that aren't tracked yet
    // (default-off — user opts in by checking).
    const next = { ...routing }
    for (const w of wiresFor(nid)) {
      if (!w.id || w.id in next) continue
      next[w.id] = (w.via ?? []).includes(epsId ?? '')
    }
    routing = next
  }
  function removeNodeSection(nid: string) {
    // Just collapses the section. Routing entries we've toggled stay
    // in `routing` so re-adding the node remembers them, and Save
    // applies them. Leaving via untouched on collapse matches the
    // user's mental model: "I'm just hiding this view, not undoing".
    visibleNodes = visibleNodes.filter((id) => id !== nid)
  }
  function toggleWire(linkId: string) {
    routing = { ...routing, [linkId]: !routing[linkId] }
  }

  // Devices the user could still add — those not already shown.
  const addableNodes = $derived(candidateNodes.filter((n) => !visibleNodes.includes(n.id)))
  let pickerOpen = $state(false)

  function save() {
    if (!epsId) return
    const scene = diagramState.scenes.find((s) => s.id === sceneId)
    const epsNode = diagramState.nodes.get(epsId)
    const epsPos =
      scene?.nodePlacements.find((p) => p.nodeId === epsId)?.position ?? epsNode?.position ?? null

    // Walk every wire we have an entry for. Entries we've never
    // touched stay out of `routing` and we don't disturb them — that
    // way wires for nodes the user never opened keep their existing
    // via untouched.
    for (const linkId of Object.keys(routing)) {
      const w = diagramState.links.find((l) => l.id === linkId)
      if (!w) continue
      const want = routing[linkId] ?? false

      let pair: { epsId: string; outletId: string } | null = null
      if (want) {
        let outletId = findAutoOutlet(diagramState.nodes, linkId, epsId)
        if (!outletId) {
          // Pick the device-side endpoint as the outlet anchor — for
          // an EPS-side modal that's whichever wire end isn't a TP.
          const fromN = diagramState.nodes.get(w.from.node)
          const toN = diagramState.nodes.get(w.to.node)
          let farId = w.to.node
          if (fromN?.termination && !toN?.termination) farId = w.to.node
          else if (!fromN?.termination && toN?.termination) farId = w.from.node
          else farId = w.to.node
          const farNode = diagramState.nodes.get(farId)
          const farPos =
            scene?.nodePlacements.find((p) => p.nodeId === farId)?.position ??
            farNode?.position ??
            null
          const outletPos = autoOutletPosition(epsPos, farPos)
          outletId = diagramState.addTerminationInScene(sceneId, outletPos, 'outlet')
          diagramState.updateNode(outletId, {
            metadata: { autoFor: autoOutletTag(linkId, epsId) },
          })
        }
        pair = { epsId, outletId }
      }

      const orphanOutlets: string[] = []
      const oldVia = w.via ?? []
      if (!want && oldVia.includes(epsId)) {
        const tagged = findAutoOutlet(diagramState.nodes, linkId, epsId)
        if (tagged) orphanOutlets.push(tagged)
      }

      const finalVia = buildViaForLink(w, [epsId], pair ? [pair] : [], orphanOutlets)
      diagramState.updateLink(linkId, { via: finalVia.length > 0 ? finalVia : undefined })

      for (const orphan of orphanOutlets) diagramState.removeNode(orphan)
    }
    onclose()
  }
</script>

<Dialog.Root open={!!epsId} onOpenChange={(v) => !v && onclose()}>
  <Dialog.Portal>
    <Dialog.Overlay class="fixed inset-0 z-40 bg-black/50" />
    <Dialog.Content
      class="fixed top-1/2 left-1/2 z-50 max-h-[80vh] w-[min(560px,92vw)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-700 dark:bg-neutral-800"
    >
      <div
        class="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-700"
      >
        <div>
          <Dialog.Title class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            Wires through — {epsLabel}
          </Dialog.Title>
          <p class="mt-0.5 text-[11px] text-muted-foreground">
            Add a node to see its wires; check the ones that should ride this chase.
          </p>
        </div>
        <Dialog.Close
          class="rounded p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-700 dark:hover:text-neutral-100"
        >
          <X class="h-4 w-4" />
        </Dialog.Close>
      </div>

      <!-- Add-node picker. Disabled when nothing in scope is left. -->
      <div
        class="flex items-center gap-2 border-b border-neutral-200 px-4 py-2 dark:border-neutral-700"
      >
        <div class="relative">
          <button
            type="button"
            class="flex items-center gap-1 rounded border border-neutral-300 px-2 py-1 text-[11px] text-neutral-700 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-600 dark:text-neutral-200 dark:hover:bg-neutral-700"
            disabled={addableNodes.length === 0}
            onclick={() => (pickerOpen = !pickerOpen)}
          >
            <Plus class="h-3 w-3" />
            Add node
            <CaretDown class="h-3 w-3" />
          </button>
          {#if pickerOpen}
            <div
              class="absolute left-0 top-full z-10 mt-1 max-h-64 w-56 overflow-y-auto rounded-md border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-800"
            >
              {#each addableNodes as n (n.id)}
                <button
                  type="button"
                  class="block w-full px-2 py-1 text-left text-[11px] text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-700"
                  onclick={() => {
                    addNode(n.id)
                    pickerOpen = false
                  }}
                >
                  {nodeLabelOf(n.id)}
                </button>
              {/each}
              {#if addableNodes.length === 0}
                <p class="px-2 py-1 text-[11px] text-muted-foreground">No more nodes in scope.</p>
              {/if}
            </div>
          {/if}
        </div>
        <span class="ml-auto text-[11px] text-muted-foreground">
          {visibleNodes.length}
          node{visibleNodes.length === 1 ? '' : 's'}
          shown
        </span>
      </div>

      <div class="max-h-[58vh] overflow-y-auto">
        {#if visibleNodes.length === 0}
          <p class="px-4 py-6 text-center text-xs text-muted-foreground">
            Use <span class="font-medium">Add node</span> to start routing wires through this EPS.
          </p>
        {:else}
          <ul class="divide-y divide-neutral-200 dark:divide-neutral-700">
            {#each visibleNodes as nid (nid)}
              {@const wires = wiresFor(nid)}
              <li class="px-4 py-2">
                <div class="mb-1 flex items-center justify-between">
                  <span class="text-xs font-medium text-neutral-800 dark:text-neutral-200">
                    {nodeLabelOf(nid)}
                  </span>
                  <button
                    type="button"
                    class="rounded p-0.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-700"
                    onclick={() => removeNodeSection(nid)}
                    aria-label="Remove section"
                  >
                    <X class="h-3 w-3" />
                  </button>
                </div>
                {#if wires.length === 0}
                  <p class="px-2 text-[11px] text-muted-foreground">No wires.</p>
                {:else}
                  <ul class="space-y-0.5">
                    {#each wires as w (w.id)}
                      {@const linkId = w.id ?? ''}
                      {@const checked = routing[linkId] ?? false}
                      <li>
                        <label
                          class="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs hover:bg-neutral-50 dark:hover:bg-neutral-700/40"
                        >
                          <input
                            type="checkbox"
                            class="h-3.5 w-3.5 accent-blue-500"
                            {checked}
                            onchange={() => toggleWire(linkId)}
                          >
                          <span class="text-muted-foreground">→</span>
                          <span class="text-neutral-800 dark:text-neutral-200">
                            {nodeLabelOf(farEndOf(linkId, nid))}
                          </span>
                        </label>
                      </li>
                    {/each}
                  </ul>
                {/if}
              </li>
            {/each}
          </ul>
        {/if}
      </div>

      <div
        class="flex justify-end gap-2 border-t border-neutral-200 px-4 py-2 dark:border-neutral-700"
      >
        <button
          type="button"
          class="rounded px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-700"
          onclick={onclose}
        >
          Cancel
        </button>
        <button
          type="button"
          class="rounded bg-blue-500 px-3 py-1 text-xs text-white hover:bg-blue-600"
          onclick={save}
        >
          Save
        </button>
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
