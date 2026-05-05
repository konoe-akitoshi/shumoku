<script lang="ts">
  import { Dialog } from 'bits-ui'
  import { X } from 'phosphor-svelte'
  import { tick } from 'svelte'
  import { diagramState } from '$lib/context.svelte'
  import {
    autoOutletPosition,
    autoOutletTag,
    buildViaForLink,
    findAutoOutlet,
  } from '$lib/scene/auto-outlets'
  import { descendantSubgraphIds } from '$lib/scene/scope'

  // Per-node routing modal. Triggered from a regular device (switch /
  // device, not a TP itself), it lists every wire incident to this
  // node as a row, with one checkbox column per EPS in scope.
  //
  // Mental model: "EPS enable" is a master switch at the top — flip it
  // on to route all of this node's wires through an EPS, then uncheck
  // exceptions. When no EPS exists yet, enabling auto-creates one.

  let {
    nodeId = null,
    sceneId,
    onclose,
  }: {
    nodeId: string | null
    sceneId: string
    onclose: () => void
  } = $props()

  const node = $derived(nodeId ? (diagramState.nodes.get(nodeId) ?? null) : null)
  const nodeLabel = $derived.by(() => {
    if (!node) return ''
    const l = node.label
    return Array.isArray(l) ? l[0] : (l ?? node.id)
  })

  const epsInScope = $derived.by(() => {
    if (!node) return []
    const allEps = [...diagramState.nodes.values()].filter((n) => n.termination?.role === 'eps')
    if (!node.parent) return allEps
    return allEps.filter((eps) => {
      if (!eps.parent) return true
      const epsScope = descendantSubgraphIds(diagramState.subgraphs, eps.parent)
      const nodeAncestors = ancestorChain(node.parent)
      for (const a of nodeAncestors) if (epsScope.has(a)) return true
      return epsScope.has(node.parent ?? '')
    })
  })

  function ancestorChain(parentId: string | undefined): string[] {
    const out: string[] = []
    let cur = parentId
    const safety = 64
    let i = 0
    while (cur && i < safety) {
      out.push(cur)
      cur = diagramState.subgraphs.get(cur)?.parent
      i++
    }
    return out
  }

  const wires = $derived(
    nodeId
      ? diagramState.links.filter((l) => !!l.id && (l.from.node === nodeId || l.to.node === nodeId))
      : [],
  )

  function farEndLabel(linkId: string): string {
    const l = diagramState.links.find((x) => x.id === linkId)
    if (!l || !nodeId) return ''
    const id = l.from.node === nodeId ? l.to.node : l.from.node
    const n = diagramState.nodes.get(id)
    if (!n) return id
    const lbl = n.label
    return Array.isArray(lbl) ? lbl[0] : (lbl ?? id)
  }

  // routing[linkId][epsId] = checked? — opt-out per cell.
  let routing = $state<Record<string, Record<string, boolean>>>({})

  // Direction heuristic: a wire where this node is the source
  // (`from.node`) is treated as downstream — these are the runs
  // that physically go to wall outlets in remote rooms via the EPS
  // chase, so we default them on. Wires where this node is the
  // target are treated as upstream / uplinks (e.g. fiber to a core
  // switch), which usually bypass the EPS — default off.
  function isDownstream(linkFrom: string, linkTo: string): boolean {
    if (linkFrom === nodeId) return true
    if (linkTo === nodeId) return false
    return false
  }

  $effect(() => {
    if (!nodeId) return
    const next: Record<string, Record<string, boolean>> = {}
    for (const w of wires) {
      const id = w.id
      if (!id) continue
      const via = w.via ?? []
      const row: Record<string, boolean> = {}
      const downstream = isDownstream(w.from.node, w.to.node)
      for (const eps of epsInScope) {
        // Existing assignments win over the default. For fresh wires,
        // default-on only for downstream wires; uplinks start unchecked.
        row[eps.id] = via.length > 0 ? via.includes(eps.id) : downstream
      }
      next[id] = row
    }
    routing = next
  })

  // Master toggle reflects "any cell enabled?" — convenient for UI but
  // not stored; flipping it just bulk-sets the matrix.
  const allEnabled = $derived.by(() => {
    if (epsInScope.length === 0 || wires.length === 0) return false
    for (const w of wires) {
      const id = w.id
      if (!id) continue
      const row = routing[id]
      if (!row) return false
      for (const eps of epsInScope) if (!row[eps.id]) return false
    }
    return true
  })
  const anyEnabled = $derived.by(() => {
    for (const w of wires) {
      const id = w.id
      if (!id) continue
      const row = routing[id]
      if (!row) continue
      for (const eps of epsInScope) if (row[eps.id]) return true
    }
    return false
  })

  function toggle(linkId: string, epsId: string) {
    const row = routing[linkId] ?? {}
    routing = { ...routing, [linkId]: { ...row, [epsId]: !row[epsId] } }
  }

  function setMatrix(value: boolean) {
    const next: Record<string, Record<string, boolean>> = {}
    for (const w of wires) {
      const id = w.id
      if (!id) continue
      const row: Record<string, boolean> = {}
      for (const eps of epsInScope) row[eps.id] = value
      next[id] = row
    }
    routing = next
  }

  function ensureEpsExists() {
    if (!nodeId || epsInScope.length > 0) return
    const scene = diagramState.scenes.find((s) => s.id === sceneId)
    const nodePlacement = scene?.nodePlacements.find((p) => p.nodeId === nodeId)
    const center = scene?.background
      ? { x: scene.background.width / 2, y: scene.background.height / 2 }
      : { x: 100, y: 100 }
    const base = nodePlacement?.position ?? center
    diagramState.addTerminationInScene(sceneId, { x: base.x + 80, y: base.y + 80 }, 'eps')
  }

  async function onMasterToggle(e: Event) {
    const want = (e.target as HTMLInputElement).checked
    if (want && epsInScope.length === 0) {
      ensureEpsExists()
      // Wait for Svelte to flush the derive that picks up the new EPS
      // before bulk-setting the matrix; otherwise setMatrix would
      // iterate the stale (empty) epsInScope and do nothing.
      await tick()
    }
    setMatrix(want)
  }

  function save() {
    if (!nodeId) return
    const scene = diagramState.scenes.find((s) => s.id === sceneId)
    const knownEpsIds = epsInScope.map((e) => e.id)

    for (const w of wires) {
      const wireId = w.id
      if (!wireId) continue
      const enabledEpsIds = epsInScope.filter((eps) => routing[wireId]?.[eps.id]).map((e) => e.id)

      // Outlets sit on the device side (room) of the wire — the
      // far-end from this node's perspective.
      const farEndId = w.from.node === nodeId ? w.to.node : w.from.node
      const farEnd = diagramState.nodes.get(farEndId)
      const farEndPos =
        scene?.nodePlacements.find((p) => p.nodeId === farEndId)?.position ??
        farEnd?.position ??
        null

      const enabledPairs: Array<{ epsId: string; outletId: string }> = []
      for (const epsId of enabledEpsIds) {
        const eps = diagramState.nodes.get(epsId)
        if (!eps) continue
        let outletId = findAutoOutlet(diagramState.nodes, wireId, epsId)
        if (!outletId) {
          const epsPos =
            scene?.nodePlacements.find((p) => p.nodeId === epsId)?.position ?? eps.position ?? null
          const outletPos = autoOutletPosition(epsPos, farEndPos)
          outletId = diagramState.addTerminationInScene(sceneId, outletPos, 'outlet')
          diagramState.updateNode(outletId, { metadata: { autoFor: autoOutletTag(wireId, epsId) } })
        }
        enabledPairs.push({ epsId, outletId })
      }

      // Auto-outlets to delete: those tagged for an EPS that just got
      // disabled (was in via, isn't enabled now). They're orphans once
      // the EPS reference goes away.
      const oldVia = w.via ?? []
      const orphanOutlets: string[] = []
      for (const epsId of knownEpsIds) {
        if (oldVia.includes(epsId) && !enabledEpsIds.includes(epsId)) {
          const tagged = findAutoOutlet(diagramState.nodes, wireId, epsId)
          if (tagged) orphanOutlets.push(tagged)
        }
      }

      const finalVia = buildViaForLink(w, knownEpsIds, enabledPairs, orphanOutlets)
      diagramState.updateLink(wireId, { via: finalVia.length > 0 ? finalVia : undefined })

      for (const orphan of orphanOutlets) diagramState.removeNode(orphan)
    }
    onclose()
  }
</script>

<Dialog.Root open={!!nodeId} onOpenChange={(v) => !v && onclose()}>
  <Dialog.Portal>
    <Dialog.Overlay class="fixed inset-0 z-40 bg-black/50" />
    <Dialog.Content
      class="fixed top-1/2 left-1/2 z-50 max-h-[80vh] w-[min(640px,92vw)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-700 dark:bg-neutral-800"
    >
      <div
        class="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-700"
      >
        <div>
          <Dialog.Title class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            Routing — {nodeLabel}
          </Dialog.Title>
          <p class="mt-0.5 text-[11px] text-muted-foreground">
            Downstream (↓) wires default on; upstream (↑) uplinks default off.
          </p>
        </div>
        <Dialog.Close
          class="rounded p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-700 dark:hover:text-neutral-100"
        >
          <X class="h-4 w-4" />
        </Dialog.Close>
      </div>

      <!-- Master switch: turns EPS routing on/off for the whole node.
           When no EPS exists yet, ticking it auto-creates one in scope. -->
      {#if wires.length > 0}
        <div
          class="flex items-center gap-3 border-b border-neutral-200 px-4 py-2 dark:border-neutral-700"
        >
          <label class="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              class="h-4 w-4 accent-blue-500"
              checked={allEnabled}
              indeterminate={!allEnabled && anyEnabled}
              onchange={onMasterToggle}
            >
            <span class="text-xs font-medium text-neutral-800 dark:text-neutral-200">
              EPS enable
            </span>
          </label>
          <span class="text-[11px] text-muted-foreground">
            {epsInScope.length === 0
              ? '(creates an EPS in scope when turned on)'
              : `(${wires.length} wire${wires.length === 1 ? '' : 's'})`}
          </span>
        </div>
      {/if}

      <div class="max-h-[58vh] overflow-y-auto">
        {#if epsInScope.length === 0}
          <p class="px-4 py-6 text-center text-xs text-muted-foreground">
            No EPS in scope. Tick <span class="font-medium">EPS enable</span> above to create one.
          </p>
        {:else if wires.length === 0}
          <p class="px-4 py-6 text-center text-xs text-muted-foreground">
            This node has no wires yet.
          </p>
        {:else}
          <table class="w-full text-xs">
            <thead
              class="sticky top-0 z-10 bg-white text-[10px] uppercase tracking-wider text-muted-foreground dark:bg-neutral-800"
            >
              <tr class="border-b border-neutral-200 dark:border-neutral-700">
                <th class="px-4 py-2 text-left font-medium">Wire</th>
                {#each epsInScope as eps (eps.id)}
                  {@const epsLabel = Array.isArray(eps.label)
                    ? eps.label[0]
                    : (eps.label ?? eps.id)}
                  <th class="px-2 py-2 font-medium">{epsLabel}</th>
                {/each}
              </tr>
            </thead>
            <tbody class="divide-y divide-neutral-100 dark:divide-neutral-700">
              {#each wires as wire (wire.id)}
                {@const linkId = wire.id ?? ''}
                {@const downstream = isDownstream(wire.from.node, wire.to.node)}
                <tr class="hover:bg-neutral-50 dark:hover:bg-neutral-700/40">
                  <td class="px-4 py-2 text-neutral-800 dark:text-neutral-200">
                    <span
                      class="mr-1 inline-block w-3 text-center font-mono text-[10px] {downstream
                        ? 'text-emerald-600'
                        : 'text-amber-600'}"
                      title={downstream ? 'downstream' : 'upstream'}
                    >
                      {downstream ? '↓' : '↑'}
                    </span>
                    {nodeLabel}
                    <span class="text-muted-foreground">↔</span>
                    {farEndLabel(linkId)}
                  </td>
                  {#each epsInScope as eps (eps.id)}
                    {@const checked = routing[linkId]?.[eps.id] ?? false}
                    <td class="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        class="h-4 w-4 accent-blue-500"
                        {checked}
                        onchange={() => toggle(linkId, eps.id)}
                      >
                    </td>
                  {/each}
                </tr>
              {/each}
            </tbody>
          </table>
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
          disabled={wires.length === 0}
        >
          Save
        </button>
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
