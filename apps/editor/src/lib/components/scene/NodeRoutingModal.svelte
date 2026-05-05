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
  function epsLabelOf(id: string): string {
    const n = diagramState.nodes.get(id)
    if (!n) return id
    const lbl = n.label
    return Array.isArray(lbl) ? lbl[0] : (lbl ?? id)
  }

  // routing[linkId] = epsId chosen for this wire, or null for "no EPS".
  let routing = $state<Record<string, string | null>>({})

  // Seed routing only on modal open. Subsequent re-derives of `wires`
  // / `epsInScope` don't clobber user edits — we only merge in shape
  // changes (new wires appear, existing entries preserved).
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
        // Existing via membership wins on first seed; default = no EPS.
        const via = w.via ?? []
        const matchedEps = via.find((vid) => epsInScope.some((e) => e.id === vid))
        next[w.id] = matchedEps ?? null
      }
      routing = next
    })
  })

  // Dropdown choices: None, each EPS, plus a sentinel "+ Create" used
  // to auto-create an EPS when scope has none (or the user wants a
  // new one). The sentinel is intercepted in onPick.
  const CREATE = '__create__'
  const NONE = '__none__'

  async function onPick(linkId: string, value: string) {
    if (value === NONE) {
      routing = { ...routing, [linkId]: null }
      return
    }
    if (value === CREATE) {
      const newId = ensureEpsExists()
      // Wait for derives to flush so the new EPS shows up in scope
      // and any future opens see it; then point this row at it.
      await tick()
      routing = { ...routing, [linkId]: newId ?? null }
      return
    }
    routing = { ...routing, [linkId]: value }
  }

  function ensureEpsExists(): string | null {
    if (!nodeId) return null
    const scene = diagramState.scenes.find((s) => s.id === sceneId)
    const nodePlacement = scene?.nodePlacements.find((p) => p.nodeId === nodeId)
    const center = scene?.background
      ? { x: scene.background.width / 2, y: scene.background.height / 2 }
      : { x: 100, y: 100 }
    const base = nodePlacement?.position ?? center
    return diagramState.addTerminationInScene(sceneId, { x: base.x + 80, y: base.y + 80 }, 'eps')
  }

  function save() {
    if (!nodeId) return
    const scene = diagramState.scenes.find((s) => s.id === sceneId)

    for (const w of wires) {
      const wireId = w.id
      if (!wireId) continue
      const wantEpsId = routing[wireId] ?? null

      const farId = w.from.node === nodeId ? w.to.node : w.from.node
      const farNode = diagramState.nodes.get(farId)
      const farPos =
        scene?.nodePlacements.find((p) => p.nodeId === farId)?.position ?? farNode?.position ?? null

      let pair: { epsId: string; outletId: string } | null = null
      if (wantEpsId) {
        const eps = diagramState.nodes.get(wantEpsId)
        if (eps) {
          let outletId = findAutoOutlet(diagramState.nodes, wireId, wantEpsId)
          if (!outletId) {
            const epsPos =
              scene?.nodePlacements.find((p) => p.nodeId === wantEpsId)?.position ??
              eps.position ??
              null
            const outletPos = autoOutletPosition(epsPos, farPos)
            outletId = diagramState.addTerminationInScene(sceneId, outletPos, 'outlet')
            diagramState.updateNode(outletId, {
              metadata: { autoFor: autoOutletTag(wireId, wantEpsId) },
            })
          }
          pair = { epsId: wantEpsId, outletId }
        }
      }

      // Cleanup auto-outlets for any in-scope EPS this wire used to
      // route through but doesn't anymore.
      const oldVia = w.via ?? []
      const orphanOutlets: string[] = []
      for (const eps of epsInScope) {
        if (eps.id === wantEpsId) continue
        if (oldVia.includes(eps.id)) {
          const tagged = findAutoOutlet(diagramState.nodes, wireId, eps.id)
          if (tagged) orphanOutlets.push(tagged)
        }
      }

      const knownEpsIds = epsInScope.map((e) => e.id)
      const finalVia = buildViaForLink(w, knownEpsIds, pair ? [pair] : [], orphanOutlets)
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
            Wire targets — {nodeLabel}
          </Dialog.Title>
          <p class="mt-0.5 text-[11px] text-muted-foreground">
            For each destination, choose which EPS the wire routes through (or leave as None).
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
                    {#each epsInScope as eps (eps.id)}
                      <option value={eps.id}>via {epsLabelOf(eps.id)}</option>
                    {/each}
                    <option value={CREATE}>+ Create EPS</option>
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
