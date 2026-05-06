<script lang="ts">
  import { Dialog } from 'bits-ui'
  import { CaretDown, X } from 'phosphor-svelte'
  import { tick, untrack } from 'svelte'
  import { diagramState } from '$lib/context.svelte'
  import {
    autoOutletPosition,
    autoOutletTag,
    buildViaForLink,
    findAutoOutlet,
  } from '$lib/scene/auto-outlets'
  import { descendantSubgraphIds } from '$lib/scene/scope'

  // Per-node routing modal. One row per wire incident to this node,
  // labeled by destination. Each row picks ONE EPS to route through
  // (or "None"). Default: None for every wire — the user opts in
  // explicitly. A "+ Create EPS" choice in the dropdown auto-creates
  // an EPS in scope when none exists yet.

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

  // Both EPS and patch panels are valid via choices for a wire from
  // this node. We surface them in scope (ancestor or sibling of this
  // node's parent subgraph). Outlets are excluded — they're auto-
  // created downstream of EPS routing, never user-picked from here.
  function tpsInScope(role: 'eps' | 'panel') {
    if (!node) return []
    const all = [...diagramState.nodes.values()].filter((n) => n.termination?.role === role)
    if (!node.parent) return all
    return all.filter((tp) => {
      if (!tp.parent) return true
      const tpScope = descendantSubgraphIds(diagramState.subgraphs, tp.parent)
      const nodeAncestors = ancestorChain(node.parent)
      for (const a of nodeAncestors) if (tpScope.has(a)) return true
      return tpScope.has(node.parent ?? '')
    })
  }
  const epsInScope = $derived.by(() => tpsInScope('eps'))
  const panelsInScope = $derived.by(() => tpsInScope('panel'))
  const allTpsInScope = $derived([...epsInScope, ...panelsInScope])

  const wires = $derived(
    nodeId
      ? diagramState.links.filter((l) => !!l.id && (l.from.node === nodeId || l.to.node === nodeId))
      : [],
  )

  function farEndId(linkId: string): string {
    const l = diagramState.links.find((x) => x.id === linkId)
    if (!l || !nodeId) return ''
    return l.from.node === nodeId ? l.to.node : l.from.node
  }
  function farEndLabel(linkId: string): string {
    const id = farEndId(linkId)
    const n = diagramState.nodes.get(id)
    if (!n) return id
    const lbl = n.label
    return Array.isArray(lbl) ? lbl[0] : (lbl ?? id)
  }
  function tpLabelOf(id: string): string {
    const n = diagramState.nodes.get(id)
    if (!n) return id
    const lbl = n.label
    return Array.isArray(lbl) ? lbl[0] : (lbl ?? id)
  }
  function tpRoleOf(id: string): 'eps' | 'panel' | 'outlet' | undefined {
    return diagramState.nodes.get(id)?.termination?.role
  }

  // routing[linkId] = TP id chosen for this wire (panel or eps), or
  // null for "no transit". Single TP per wire (Model Z) — a port has
  // one direct downstream connection, so we don't allow stacking.
  let routing = $state<Record<string, string | null>>({})

  // Seed routing only on modal open. Subsequent re-derives don't
  // clobber user edits — `untrack` keeps the seed firing only when
  // nodeId itself changes (modal open / close).
  $effect(() => {
    const id = nodeId
    if (!id) return
    untrack(() => {
      const next: Record<string, string | null> = {}
      for (const w of wires) {
        if (!w.id) continue
        if (w.id in routing) {
          next[w.id] = routing[w.id] ?? null
          continue
        }
        // Existing via membership wins on first seed; pick the first
        // in-scope TP from the link's via, else None.
        const via = w.via ?? []
        const matched = via.find((vid) => allTpsInScope.some((t) => t.id === vid))
        next[w.id] = matched ?? null
      }
      routing = next
    })
  })

  // Dropdown sentinels. Real TP ids never start with "__".
  const CREATE_EPS = '__create_eps__'
  const CREATE_PANEL = '__create_panel__'
  const NONE = '__none__'

  async function onPick(linkId: string, value: string) {
    if (value === NONE) {
      routing = { ...routing, [linkId]: null }
      return
    }
    if (value === CREATE_EPS || value === CREATE_PANEL) {
      const role = value === CREATE_EPS ? 'eps' : 'panel'
      const newId = ensureTpExists(role)
      await tick()
      routing = { ...routing, [linkId]: newId ?? null }
      return
    }
    routing = { ...routing, [linkId]: value }
  }

  function ensureTpExists(role: 'eps' | 'panel'): string | null {
    if (!nodeId) return null
    const scene = diagramState.scenes.find((s) => s.id === sceneId)
    const nodePlacement = scene?.nodePlacements.find((p) => p.nodeId === nodeId)
    const center = scene?.background
      ? { x: scene.background.width / 2, y: scene.background.height / 2 }
      : { x: 100, y: 100 }
    const base = nodePlacement?.position ?? center
    // Stagger panels and EPSes a bit so creating both doesn't stack
    // them on the same point.
    const offset = role === 'panel' ? { x: -80, y: 80 } : { x: 80, y: 80 }
    return diagramState.addTerminationInScene(
      sceneId,
      { x: base.x + offset.x, y: base.y + offset.y },
      role,
    )
  }

  function save() {
    if (!nodeId) return
    const scene = diagramState.scenes.find((s) => s.id === sceneId)

    for (const w of wires) {
      const wireId = w.id
      if (!wireId) continue
      const wantTpId = routing[wireId] ?? null
      const wantRole = wantTpId ? tpRoleOf(wantTpId) : undefined

      const farId = w.from.node === nodeId ? w.to.node : w.from.node
      const farNode = diagramState.nodes.get(farId)
      const farPos =
        scene?.nodePlacements.find((p) => p.nodeId === farId)?.position ?? farNode?.position ?? null

      // Build the new via tail. EPS routing pairs with an auto-outlet
      // on the device side; panel routing terminates without one
      // (the cable physically ends at the panel jack).
      const viaTail: string[] = []
      let createdOutletId: string | null = null
      if (wantTpId && wantRole === 'eps') {
        viaTail.push(wantTpId)
        let outletId = findAutoOutlet(diagramState.nodes, wireId, wantTpId)
        if (!outletId) {
          const epsNode = diagramState.nodes.get(wantTpId)
          const epsPos =
            scene?.nodePlacements.find((p) => p.nodeId === wantTpId)?.position ??
            epsNode?.position ??
            null
          const outletPos = autoOutletPosition(epsPos, farPos)
          outletId = diagramState.addTerminationInScene(sceneId, outletPos, 'outlet')
          diagramState.updateNode(outletId, {
            metadata: { autoFor: autoOutletTag(wireId, wantTpId) },
          })
        }
        viaTail.push(outletId)
        createdOutletId = outletId
      } else if (wantTpId && wantRole === 'panel') {
        viaTail.push(wantTpId)
      }

      // Auto-outlets to clean up: tagged for any in-scope EPS that's
      // no longer the chosen TP.
      const oldVia = w.via ?? []
      const orphanOutlets: string[] = []
      for (const eps of epsInScope) {
        if (eps.id === wantTpId) continue
        if (oldVia.includes(eps.id)) {
          const tagged = findAutoOutlet(diagramState.nodes, wireId, eps.id)
          if (tagged) orphanOutlets.push(tagged)
        }
      }

      // Managed ids = all TPs we know about + auto-outlets we touch
      // (the new one for the current pick + the orphans being removed).
      const managedIds = [...allTpsInScope.map((t) => t.id), ...orphanOutlets]
      if (createdOutletId) managedIds.push(createdOutletId)

      const finalVia = buildViaForLink(w, managedIds, viaTail)
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
      class="fixed top-1/2 left-1/2 z-50 max-h-[80vh] w-[min(560px,92vw)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-700 dark:bg-neutral-800"
    >
      <div
        class="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-700"
      >
        <div>
          <Dialog.Title class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            Wire routing — {nodeLabel}
          </Dialog.Title>
          <p class="mt-0.5 text-[11px] text-muted-foreground">
            For each destination, pick a patch panel or EPS the wire routes through (or None).
          </p>
        </div>
        <Dialog.Close
          class="rounded p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-700 dark:hover:text-neutral-100"
        >
          <X class="h-4 w-4" />
        </Dialog.Close>
      </div>

      <div class="max-h-[58vh] overflow-y-auto">
        {#if wires.length === 0}
          <p class="px-4 py-6 text-center text-xs text-muted-foreground">
            This node has no wires yet.
          </p>
        {:else}
          <ul class="divide-y divide-neutral-100 dark:divide-neutral-700">
            {#each wires as wire (wire.id)}
              {@const linkId = wire.id ?? ''}
              {@const current = routing[linkId] ?? null}
              <li class="flex items-center gap-3 px-4 py-2">
                <span class="flex-1 text-xs text-neutral-800 dark:text-neutral-200">
                  → {farEndLabel(linkId)}
                </span>
                <div class="relative">
                  <select
                    class="appearance-none rounded border border-neutral-300 bg-white py-1 pl-2 pr-7 text-xs dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-100"
                    value={current ?? NONE}
                    onchange={(e) => onPick(linkId, (e.target as HTMLSelectElement).value)}
                  >
                    <option value={NONE}>None</option>
                    <optgroup label="Patch panel">
                      {#each panelsInScope as p (p.id)}
                        <option value={p.id}>{tpLabelOf(p.id)}</option>
                      {/each}
                      <option value={CREATE_PANEL}>+ Create panel</option>
                    </optgroup>
                    <optgroup label="EPS / chase">
                      {#each epsInScope as eps (eps.id)}
                        <option value={eps.id}>{tpLabelOf(eps.id)}</option>
                      {/each}
                      <option value={CREATE_EPS}>+ Create EPS</option>
                    </optgroup>
                  </select>
                  <CaretDown
                    class="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground"
                  />
                </div>
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
          disabled={wires.length === 0}
        >
          Save
        </button>
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
