<script lang="ts">
  import { goto } from '$app/navigation'
  import { Badge } from '$lib/components/ui/badge'
  import * as Card from '$lib/components/ui/card'
  import * as Table from '$lib/components/ui/table'
  import { diagramState } from '$lib/context.svelte'
  import { getPaletteEntryPower } from '$lib/spec-utils'
  import { paletteEntryLabel } from '$lib/types'

  interface BomRow {
    nodeId: string
    nodeLabel: string
    paletteId: string | undefined
    paletteName: string
    bound: boolean
  }

  const rows = $derived.by<BomRow[]>(() => {
    const result: BomRow[] = []
    const paletteById = new Map(diagramState.palette.map((e) => [e.id, e]))
    const bindings = diagramState.nodeBindings // read the reactive Map directly

    for (const [nodeId, rn] of diagramState.nodes) {
      const label = Array.isArray(rn.node.label) ? rn.node.label[0] : (rn.node.label ?? nodeId)
      const paletteId = bindings.get(nodeId)
      const entry = paletteId ? paletteById.get(paletteId) : undefined
      result.push({
        nodeId,
        nodeLabel: label,
        paletteId,
        paletteName: entry ? paletteEntryLabel(entry) : '',
        bound: !!entry,
      })
    }
    return result.sort((a, b) => a.nodeId.localeCompare(b.nodeId))
  })

  const boundCount = $derived(rows.filter((r) => r.bound).length)
  const unboundCount = $derived(rows.filter((r) => !r.bound).length)

  // Summary by palette entry
  interface SpecSummary {
    paletteId: string
    label: string
    count: number
    power: { maxDraw?: number; poeBudget?: number }
  }

  const specSummary = $derived.by<SpecSummary[]>(() => {
    const counts = new Map<string, number>()
    for (const row of rows) {
      if (!row.paletteId) continue
      counts.set(row.paletteId, (counts.get(row.paletteId) ?? 0) + 1)
    }
    const paletteById = new Map(diagramState.palette.map((e) => [e.id, e]))
    return [...counts.entries()].map(([palId, count]) => {
      const entry = paletteById.get(palId)
      return {
        paletteId: palId,
        label: entry ? paletteEntryLabel(entry) : palId,
        count,
        power: entry ? getPaletteEntryPower(entry) : {},
      }
    })
  })

  const totalPower = $derived(specSummary.reduce((s, e) => s + (e.power.maxDraw ?? 0) * e.count, 0))
  const totalPoeBudget = $derived(
    specSummary.reduce((s, e) => s + (e.power.poeBudget ?? 0) * e.count, 0),
  )
</script>

<div class="mb-6">
  <h1 class="text-lg font-semibold">Bill of Materials</h1>
  <p class="text-sm text-muted-foreground">Node ↔ Spec bindings</p>
</div>

<!-- Summary cards -->
<div class="grid grid-cols-4 gap-3 mb-6">
  <Card.Root>
    <Card.Content class="pt-4">
      <div class="text-xs uppercase tracking-wider text-muted-foreground">Nodes</div>
      <div class="text-2xl font-mono font-bold">{rows.length}</div>
    </Card.Content>
  </Card.Root>
  <Card.Root>
    <Card.Content class="pt-4">
      <div class="text-xs uppercase tracking-wider text-muted-foreground">Bound</div>
      <div class="text-2xl font-mono font-bold text-green-600">{boundCount}</div>
    </Card.Content>
  </Card.Root>
  <Card.Root>
    <Card.Content class="pt-4">
      <div class="text-xs uppercase tracking-wider text-muted-foreground">Total Power</div>
      <div class="text-2xl font-mono font-bold">{totalPower}W</div>
    </Card.Content>
  </Card.Root>
  <Card.Root>
    <Card.Content class="pt-4">
      <div class="text-xs uppercase tracking-wider text-muted-foreground">PoE Budget</div>
      <div class="text-2xl font-mono font-bold">{totalPoeBudget}W</div>
    </Card.Content>
  </Card.Root>
</div>

<!-- Unbound warning -->
{#if unboundCount > 0}
  <Card.Root class="mb-6 border-destructive/50 bg-destructive/5">
    <Card.Content class="pt-4">
      <div class="text-xs font-semibold text-destructive mb-1">
        {unboundCount}
        node(s) not bound to any spec
      </div>
      <p class="text-[10px] text-muted-foreground">These nodes have no Palette entry assigned.</p>
    </Card.Content>
  </Card.Root>
{/if}

<!-- Node binding table -->
{#if rows.length > 0}
  <Card.Root class="py-0 mb-6">
    <Table.Root>
      <Table.Header>
        <Table.Row>
          <Table.Head>Node ID</Table.Head>
          <Table.Head>Label</Table.Head>
          <Table.Head>Spec</Table.Head>
          <Table.Head>Status</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each rows as row (row.nodeId)}
          <Table.Row class={!row.bound ? 'bg-destructive/5' : ''}>
            <Table.Cell class="font-mono text-xs">{row.nodeId}</Table.Cell>
            <Table.Cell class="font-medium">{row.nodeLabel}</Table.Cell>
            <Table.Cell>
              <select
                class="w-full px-2 py-1 text-xs bg-background border border-input rounded-lg outline-none focus:ring-1 focus:ring-ring {!row.bound ? 'border-destructive/50' : ''}"
                value={row.paletteId ?? ''}
                onchange={(e) => {
                  const val = (e.target as HTMLSelectElement).value
                  if (val) diagramState.bindNode(row.nodeId, val)
                  else diagramState.unbindNode(row.nodeId)
                }}
              >
                <option value="">-- unbound --</option>
                {#each diagramState.palette as pal}
                  <option value={pal.id}>{paletteEntryLabel(pal)}</option>
                {/each}
              </select>
            </Table.Cell>
            <Table.Cell>
              {#if row.bound}
                <Badge variant="default">bound</Badge>
              {:else}
                <Badge variant="destructive">unbound</Badge>
              {/if}
            </Table.Cell>
          </Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
  </Card.Root>
{/if}

<!-- Spec summary -->
{#if specSummary.length > 0}
  <h2 class="text-sm font-semibold mb-3">Summary by Spec</h2>
  <Card.Root class="py-0">
    <Table.Root>
      <Table.Header>
        <Table.Row>
          <Table.Head>Spec</Table.Head>
          <Table.Head class="text-right">Qty</Table.Head>
          <Table.Head class="text-right">Unit Power</Table.Head>
          <Table.Head class="text-right">Total Power</Table.Head>
          <Table.Head class="text-right">PoE Budget</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each specSummary as s}
          <Table.Row>
            <Table.Cell>
              <button
                type="button"
                class="text-xs text-primary hover:underline cursor-pointer"
                onclick={() => goto(`/specs/${s.paletteId}`)}
              >
                {s.label}
              </button>
            </Table.Cell>
            <Table.Cell class="text-right font-mono font-semibold">{s.count}</Table.Cell>
            <Table.Cell class="text-right font-mono text-muted-foreground"
              >{s.power.maxDraw ? `${s.power.maxDraw}W` : '—'}</Table.Cell
            >
            <Table.Cell class="text-right font-mono"
              >{s.power.maxDraw ? `${s.power.maxDraw * s.count}W` : '—'}</Table.Cell
            >
            <Table.Cell class="text-right font-mono"
              >{s.power.poeBudget ? `${s.power.poeBudget * s.count}W` : '—'}</Table.Cell
            >
          </Table.Row>
        {/each}
      </Table.Body>
      <Table.Footer>
        <Table.Row>
          <Table.Cell class="font-semibold">Total</Table.Cell>
          <Table.Cell class="text-right font-mono font-semibold">{boundCount}</Table.Cell>
          <Table.Cell></Table.Cell>
          <Table.Cell class="text-right font-mono font-semibold">{totalPower}W</Table.Cell>
          <Table.Cell class="text-right font-mono font-semibold">{totalPoeBudget}W</Table.Cell>
        </Table.Row>
      </Table.Footer>
    </Table.Root>
  </Card.Root>
{/if}
