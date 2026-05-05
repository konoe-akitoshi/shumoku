<script lang="ts">
  import { Dialog } from 'bits-ui'
  import { X } from 'phosphor-svelte'
  import { diagramState } from '$lib/context.svelte'
  import {
    autoOutletPosition,
    autoOutletTag,
    buildViaForLink,
    findAutoOutlet,
  } from '$lib/scene/auto-outlets'
  import { descendantSubgraphIds } from '$lib/scene/scope'

  // Per-EPS routing modal (complement to NodeRoutingModal). Where the
  // node-side modal answers "what does THIS device's wires route
  // through?", this one answers "what's going through THIS chase?".
  // Same Link.via store; just a different lens for editing it.
  //
  // Useful when several switches in a rack share one EPS-A — manage
  // the chase's contents in one place instead of opening each switch.

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

  // Candidate links: any wire with at least one regular (non-TP)
  // endpoint inside the EPS's scope. Wires entirely between TPs are
  // structural (e.g. outlet ↔ panel) and don't make sense to route
  // through this EPS.
  const candidates = $derived.by(() => {
    if (!eps) return []
    const scopeIds = eps.parent ? descendantSubgraphIds(diagramState.subgraphs, eps.parent) : null
    return diagramState.links.filter((l) => {
      if (!l.id) return false
      const fromN = diagramState.nodes.get(l.from.node)
      const toN = diagramState.nodes.get(l.to.node)
      if (!fromN || !toN) return false
      if (fromN.termination && toN.termination) return false
      const fromIn =
        scopeIds === null ? !fromN.parent : !!fromN.parent && scopeIds.has(fromN.parent)
      const toIn = scopeIds === null ? !toN.parent : !!toN.parent && scopeIds.has(toN.parent)
      return fromIn || toIn
    })
  })

  function farDeviceFromEpsView(link: { from: { node: string }; to: { node: string } }): string {
    // The "device-side" end of the wire — used to bias outlet
    // placement. When both endpoints are devices (a wire that crosses
    // the chase between two rooms), pick the to-side; the user can
    // drag if this default doesn't fit.
    const fromN = diagramState.nodes.get(link.from.node)
    const toN = diagramState.nodes.get(link.to.node)
    if (fromN?.termination && !toN?.termination) return link.to.node
    if (!fromN?.termination && toN?.termination) return link.from.node
    return link.to.node
  }

  function endpointLabel(id: string): string {
    const n = diagramState.nodes.get(id)
    if (!n) return id
    const l = n.label
    return Array.isArray(l) ? l[0] : (l ?? id)
  }

  // routing[linkId] = checked? — single-EPS context, so flat record.
  let routing = $state<Record<string, boolean>>({})

  $effect(() => {
    if (!epsId) return
    const next: Record<string, boolean> = {}
    for (const w of candidates) {
      if (!w.id) continue
      const via = w.via ?? []
      // Existing membership wins; for fresh wires default-on (opt-out
      // posture: this EPS is the chase, so by default it carries the
      // wires in its scope).
      next[w.id] = via.length > 0 ? via.includes(epsId) : true
    }
    routing = next
  })

  function toggle(linkId: string) {
    routing = { ...routing, [linkId]: !routing[linkId] }
  }
  function setAll(value: boolean) {
    const next: Record<string, boolean> = {}
    for (const w of candidates) if (w.id) next[w.id] = value
    routing = next
  }

  const allEnabled = $derived.by(() => {
    if (candidates.length === 0) return false
    for (const w of candidates) {
      if (!w.id) continue
      if (!routing[w.id]) return false
    }
    return true
  })
  const anyEnabled = $derived(Object.values(routing).some((v) => v))

  function save() {
    if (!epsId) return
    const scene = diagramState.scenes.find((s) => s.id === sceneId)
    const epsNode = diagramState.nodes.get(epsId)
    const epsPos =
      scene?.nodePlacements.find((p) => p.nodeId === epsId)?.position ?? epsNode?.position ?? null

    for (const w of candidates) {
      const wireId = w.id
      if (!wireId) continue
      const want = routing[wireId] ?? false

      let pair: { epsId: string; outletId: string } | null = null
      if (want) {
        let outletId = findAutoOutlet(diagramState.nodes, wireId, epsId)
        if (!outletId) {
          const farId = farDeviceFromEpsView(w)
          const farNode = diagramState.nodes.get(farId)
          const farPos =
            scene?.nodePlacements.find((p) => p.nodeId === farId)?.position ??
            farNode?.position ??
            null
          const outletPos = autoOutletPosition(epsPos, farPos)
          outletId = diagramState.addTerminationInScene(sceneId, outletPos, 'outlet')
          diagramState.updateNode(outletId, { metadata: { autoFor: autoOutletTag(wireId, epsId) } })
        }
        pair = { epsId, outletId }
      }

      const orphanOutlets: string[] = []
      const oldVia = w.via ?? []
      if (!want && oldVia.includes(epsId)) {
        const tagged = findAutoOutlet(diagramState.nodes, wireId, epsId)
        if (tagged) orphanOutlets.push(tagged)
      }

      const finalVia = buildViaForLink(w, [epsId], pair ? [pair] : [], orphanOutlets)
      diagramState.updateLink(wireId, { via: finalVia.length > 0 ? finalVia : undefined })

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
            All wires in this chase's scope. Uncheck the ones that bypass it (e.g. fiber uplinks).
          </p>
        </div>
        <Dialog.Close
          class="rounded p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-700 dark:hover:text-neutral-100"
        >
          <X class="h-4 w-4" />
        </Dialog.Close>
      </div>

      {#if candidates.length > 0}
        <div
          class="flex items-center gap-3 border-b border-neutral-200 px-4 py-2 dark:border-neutral-700"
        >
          <label class="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              class="h-4 w-4 accent-blue-500"
              checked={allEnabled}
              indeterminate={!allEnabled && anyEnabled}
              onchange={(e) => setAll((e.target as HTMLInputElement).checked)}
            >
            <span class="text-xs font-medium text-neutral-800 dark:text-neutral-200">
              Through this EPS
            </span>
          </label>
          <span class="ml-auto text-[11px] text-muted-foreground">
            {candidates.length}
            wire{candidates.length === 1 ? '' : 's'}
            in scope
          </span>
        </div>
      {/if}

      <div class="max-h-[58vh] overflow-y-auto">
        {#if candidates.length === 0}
          <p class="px-4 py-6 text-center text-xs text-muted-foreground">
            No wires in this chase's scope.
          </p>
        {:else}
          <ul class="divide-y divide-neutral-100 dark:divide-neutral-700">
            {#each candidates as wire (wire.id)}
              {@const linkId = wire.id ?? ''}
              {@const checked = routing[linkId] ?? false}
              <li>
                <label
                  class="flex cursor-pointer items-center gap-3 px-4 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-700/40"
                >
                  <input
                    type="checkbox"
                    class="h-4 w-4 accent-blue-500"
                    {checked}
                    onchange={() => toggle(linkId)}
                  >
                  <span class="flex-1 text-xs text-neutral-800 dark:text-neutral-200">
                    {endpointLabel(wire.from.node)}
                    <span class="text-muted-foreground">↔</span>
                    {endpointLabel(wire.to.node)}
                  </span>
                </label>
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
          disabled={candidates.length === 0}
        >
          Save
        </button>
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
