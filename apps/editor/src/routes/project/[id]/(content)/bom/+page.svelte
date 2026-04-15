<script lang="ts">
  import { DropdownMenu } from 'bits-ui'
  import { nanoid } from 'nanoid'
  import { CaretDown, Plus, Trash } from 'phosphor-svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import { Badge } from '$lib/components/ui/badge'
  import { Button } from '$lib/components/ui/button'
  import * as Card from '$lib/components/ui/card'
  import * as Table from '$lib/components/ui/table'
  import { diagramState } from '$lib/context.svelte'
  import { getPaletteEntryPower } from '$lib/spec-utils'
  import { paletteEntryLabel } from '$lib/types'

  const paletteById = $derived(new Map(diagramState.palette.map((e) => [e.id, e])))
  const items = $derived(diagramState.bomItems)

  const placedCount = $derived(items.filter((i) => i.nodeId).length)
  const unplacedCount = $derived(items.filter((i) => !i.nodeId).length)

  // Available (unbound) nodes
  const boundNodeIds = $derived(new Set(items.filter((i) => i.nodeId).map((i) => i.nodeId)))
  const unboundNodes = $derived(
    [...diagramState.nodes.entries()]
      .filter(([id]) => !boundNodeIds.has(id))
      .map(([id, rn]) => ({
        id,
        label: Array.isArray(rn.node.label) ? rn.node.label[0] : (rn.node.label ?? id),
      })),
  )

  // Spec summary
  const specSummary = $derived.by(() => {
    const groups = new Map<string, { total: number; placed: number }>()
    for (const item of items) {
      const g = groups.get(item.paletteId) ?? { total: 0, placed: 0 }
      g.total++
      if (item.nodeId) g.placed++
      groups.set(item.paletteId, g)
    }
    return [...groups.entries()].map(([palId, { total, placed }]) => {
      const entry = paletteById.get(palId)
      return {
        paletteId: palId,
        label: entry ? paletteEntryLabel(entry) : palId,
        total,
        placed,
        power: entry ? getPaletteEntryPower(entry) : {},
      }
    })
  })

  const totalPower = $derived(
    specSummary.reduce((s, e) => s + (e.power.maxDraw ?? 0) * e.placed, 0),
  )
  const totalPoeBudget = $derived(
    specSummary.reduce((s, e) => s + (e.power.poeBudget ?? 0) * e.total, 0),
  )

  function addBomItem(paletteId: string) {
    diagramState.addBomItem({ id: nanoid(), paletteId })
  }
</script>

<div class="flex items-center justify-between mb-6">
  <div>
    <h1 class="text-lg font-semibold">Bill of Materials</h1>
    <p class="text-sm text-muted-foreground">{items.length} items, {placedCount} placed</p>
  </div>
  {#if diagramState.palette.length > 0}
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        {#snippet child({ props })}
          <Button size="sm" {...props}>
            <Plus class="w-4 h-4 mr-1" />
            Add
            <CaretDown class="w-3 h-3 ml-1" />
          </Button>
        {/snippet}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content
        class="z-50 min-w-48 rounded-lg border bg-popover p-1 shadow-md max-h-64 overflow-auto"
      >
        {#each diagramState.palette as pal}
          <DropdownMenu.Item
            class="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs cursor-pointer hover:bg-accent"
            onclick={() => addBomItem(pal.id)}
          >
            {paletteEntryLabel(pal)}
          </DropdownMenu.Item>
        {/each}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  {/if}
</div>

<div class="grid grid-cols-4 gap-3 mb-6">
  <Card.Root>
    <Card.Content class="pt-4">
      <div class="text-xs uppercase tracking-wider text-muted-foreground">Total</div>
      <div class="text-2xl font-mono font-bold">{items.length}</div>
    </Card.Content>
  </Card.Root>
  <Card.Root>
    <Card.Content class="pt-4">
      <div class="text-xs uppercase tracking-wider text-muted-foreground">Placed</div>
      <div class="text-2xl font-mono font-bold text-green-600">{placedCount}</div>
    </Card.Content>
  </Card.Root>
  <Card.Root>
    <Card.Content class="pt-4">
      <div class="text-xs uppercase tracking-wider text-muted-foreground">Power</div>
      <div class="text-2xl font-mono font-bold">{totalPower}W</div>
    </Card.Content>
  </Card.Root>
  <Card.Root>
    <Card.Content class="pt-4">
      <div class="text-xs uppercase tracking-wider text-muted-foreground">PoE</div>
      <div class="text-2xl font-mono font-bold">{totalPoeBudget}W</div>
    </Card.Content>
  </Card.Root>
</div>

{#if unplacedCount > 0}
  <Card.Root
    class="mb-6 border-amber-300/50 bg-amber-50/50 dark:border-amber-700/50 dark:bg-amber-900/10"
  >
    <Card.Content class="pt-4">
      <div class="text-xs font-semibold text-amber-700 dark:text-amber-400">
        {unplacedCount}
        item(s) not placed on diagram
      </div>
    </Card.Content>
  </Card.Root>
{/if}

{#if items.length > 0}
  <Card.Root class="py-0 mb-6">
    <Table.Root>
      <Table.Header>
        <Table.Row>
          <Table.Head>Spec</Table.Head>
          <Table.Head>Node</Table.Head>
          <Table.Head>Status</Table.Head>
          <Table.Head class="w-10"></Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each items as item (item.id)}
          {@const pal = paletteById.get(item.paletteId)}
          <Table.Row class={!item.nodeId ? 'bg-amber-50/50 dark:bg-amber-900/5' : ''}>
            <Table.Cell>
              {#if pal}
                <button
                  type="button"
                  class="text-xs text-primary hover:underline cursor-pointer"
                  onclick={() => goto(`/project/${$page.params.id}/specs/${pal.id}`)}
                >
                  {paletteEntryLabel(pal)}
                </button>
              {:else}
                <span class="text-xs text-muted-foreground italic">unknown</span>
              {/if}
            </Table.Cell>
            <Table.Cell>
              {#if item.nodeId}
                <span class="font-mono text-xs">{item.nodeId}</span>
              {:else}
                <select
                  class="px-2 py-1 text-xs bg-background border border-input rounded-lg outline-none focus:ring-1 focus:ring-ring"
                  value=""
                  onchange={(e) => {
                    const val = (e.target as HTMLSelectElement).value
                    if (val) diagramState.bindNodeToBom(item.id, val)
                  }}
                >
                  <option value="">-- assign node --</option>
                  {#each unboundNodes as node}
                    <option value={node.id}>{node.id} ({node.label})</option>
                  {/each}
                </select>
              {/if}
            </Table.Cell>
            <Table.Cell>
              {#if item.nodeId}
                <Badge variant="default">placed</Badge>
              {:else}
                <Badge variant="secondary">unplaced</Badge>
              {/if}
            </Table.Cell>
            <Table.Cell>
              <Button
                variant="ghost"
                size="icon"
                onclick={() => diagramState.removeBomItem(item.id)}
              >
                <Trash class="w-3.5 h-3.5 text-destructive" />
              </Button>
            </Table.Cell>
          </Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
  </Card.Root>
{:else}
  <Card.Root class="py-16 mb-6">
    <Card.Content class="flex flex-col items-center text-center text-muted-foreground">
      <p class="text-sm">No items. Click "Add" to add devices from your Spec Palette.</p>
    </Card.Content>
  </Card.Root>
{/if}

{#if specSummary.length > 0}
  <h2 class="text-sm font-semibold mb-3">Summary by Spec</h2>
  <Card.Root class="py-0">
    <Table.Root>
      <Table.Header>
        <Table.Row>
          <Table.Head>Spec</Table.Head>
          <Table.Head class="text-right">Total</Table.Head>
          <Table.Head class="text-right">Placed</Table.Head>
          <Table.Head class="text-right">Power (placed)</Table.Head>
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
                onclick={() => goto(`/project/${$page.params.id}/specs/${s.paletteId}`)}
              >
                {s.label}
              </button>
            </Table.Cell>
            <Table.Cell class="text-right font-mono font-semibold">{s.total}</Table.Cell>
            <Table.Cell class="text-right font-mono {s.placed < s.total ? 'text-amber-600' : ''}"
              >{s.placed}</Table.Cell
            >
            <Table.Cell class="text-right font-mono"
              >{s.power.maxDraw ? `${s.power.maxDraw * s.placed}W` : '—'}</Table.Cell
            >
            <Table.Cell class="text-right font-mono"
              >{s.power.poeBudget ? `${s.power.poeBudget * s.total}W` : '—'}</Table.Cell
            >
          </Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
  </Card.Root>
{/if}
