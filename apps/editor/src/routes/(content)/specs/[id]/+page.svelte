<script lang="ts">
  import type { HardwareProperties } from '@shumoku/catalog'
  import { ArrowLeft } from 'phosphor-svelte'
  import { page } from '$app/stores'
  import { Badge } from '$lib/components/ui/badge'
  import { Button } from '$lib/components/ui/button'
  import * as Card from '$lib/components/ui/card'
  import * as Table from '$lib/components/ui/table'
  import { diagramState } from '$lib/context.svelte'
  import { paletteEntryLabel, specIdentifier } from '$lib/types'

  const entry = $derived(diagramState.palette.find((e) => e.id === $page.params.id))

  const hw = $derived(
    entry?.spec.kind === 'hardware' && entry.properties
      ? (entry.properties as HardwareProperties)
      : null,
  )

  // BOM items for this spec
  const bomItemsForSpec = $derived(entry ? diagramState.getBomItemsForPalette(entry.id) : [])
  const placedNodes = $derived(
    bomItemsForSpec.filter((i) => i.nodeId).map((i) => i.nodeId as string),
  )

  // biome-ignore lint/suspicious/noExplicitAny: flatten unknown property groups
  function flattenProps(obj: Record<string, any>, prefix = ''): { key: string; value: string }[] {
    const result: { key: string; value: string }[] = []
    for (const [k, v] of Object.entries(obj)) {
      if (v === undefined || v === null) continue
      const fullKey = prefix ? `${prefix}.${k}` : k
      if (Array.isArray(v)) {
        if (v.length > 0 && typeof v[0] === 'object') {
          for (const [i, item] of v.entries()) {
            const parts = Object.entries(item)
              .filter(([, val]) => val !== undefined && val !== null)
              .map(([key, val]) => `${key}: ${val}`)
            result.push({ key: `${fullKey}[${i}]`, value: parts.join(', ') })
          }
        } else {
          result.push({ key: fullKey, value: v.join(', ') })
        }
      } else if (typeof v === 'object') {
        result.push(...flattenProps(v, fullKey))
      } else {
        result.push({ key: fullKey, value: String(v) })
      }
    }
    return result
  }

  const allProps = $derived(entry?.properties ? flattenProps(entry.properties) : [])
</script>

{#if entry}
  <div class="mb-6">
    <a
      href="/specs"
      class="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3"
    >
      <ArrowLeft class="w-3.5 h-3.5" />
      Back to Specs
    </a>
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-lg font-semibold">{paletteEntryLabel(entry)}</h1>
        <div class="flex items-center gap-2 mt-1">
          <Badge variant="secondary">{entry.spec.kind}</Badge>
          {#if entry.source === 'catalog'}
            <Badge variant="default">catalog</Badge>
          {:else if entry.source === 'modified'}
            <Badge variant="secondary">modified</Badge>
          {:else}
            <Badge variant="outline">custom</Badge>
          {/if}
        </div>
      </div>
    </div>
  </div>

  <!-- Spec identity -->
  <div class="grid grid-cols-2 gap-6 mb-6">
    <Card.Root>
      <Card.Header> <Card.Title>Identity</Card.Title> </Card.Header>
      <Card.Content>
        <dl class="space-y-2 text-xs">
          <div class="flex justify-between">
            <dt class="text-muted-foreground">Kind</dt>
            <dd class="font-mono">{entry.spec.kind}</dd>
          </div>
          {#if entry.spec.vendor}
            <div class="flex justify-between">
              <dt class="text-muted-foreground">Vendor</dt>
              <dd class="font-mono">{entry.spec.vendor}</dd>
            </div>
          {/if}
          <div class="flex justify-between">
            <dt class="text-muted-foreground">
              {entry.spec.kind === 'service' ? 'Service' : entry.spec.kind === 'compute' ? 'Platform' : 'Model'}
            </dt>
            <dd class="font-mono">{specIdentifier(entry.spec)}</dd>
          </div>
          {#if entry.spec.kind === 'hardware' && 'type' in entry.spec && entry.spec.type}
            <div class="flex justify-between">
              <dt class="text-muted-foreground">Type</dt>
              <dd class="font-mono">{entry.spec.type}</dd>
            </div>
          {/if}
          {#if entry.catalogId}
            <div class="flex justify-between">
              <dt class="text-muted-foreground">Catalog ID</dt>
              <dd class="font-mono text-[10px]">{entry.catalogId}</dd>
            </div>
          {/if}
        </dl>
      </Card.Content>
    </Card.Root>

    <Card.Root>
      <Card.Header> <Card.Title>Usage</Card.Title> </Card.Header>
      <Card.Content>
        <div class="text-2xl font-mono font-bold mb-1">{bomItemsForSpec.length}</div>
        <div class="text-xs text-muted-foreground mb-3">
          {placedNodes.length}
          placed, {bomItemsForSpec.length - placedNodes.length} unplaced
        </div>
        {#if placedNodes.length > 0}
          <div class="flex flex-wrap gap-1">
            {#each placedNodes as nodeId}
              <Badge variant="outline" class="font-mono text-[10px]">{nodeId}</Badge>
            {/each}
          </div>
        {/if}
      </Card.Content>
    </Card.Root>
  </div>

  <!-- Properties -->
  {#if allProps.length > 0}
    <Card.Root class="py-0 mb-6">
      <Card.Header> <Card.Title>Properties</Card.Title> </Card.Header>
      <Table.Root>
        <Table.Body>
          {#each allProps as { key, value }}
            <Table.Row>
              <Table.Cell class="text-muted-foreground w-1/3">{key}</Table.Cell>
              <Table.Cell class="font-mono">{value}</Table.Cell>
            </Table.Row>
          {/each}
        </Table.Body>
      </Table.Root>
    </Card.Root>
  {/if}

  <!-- Notes -->
  {#if entry.notes}
    <Card.Root>
      <Card.Header> <Card.Title>Notes</Card.Title> </Card.Header>
      <Card.Content>
        <p class="text-xs text-muted-foreground whitespace-pre-wrap">{entry.notes}</p>
      </Card.Content>
    </Card.Root>
  {/if}
{:else}
  <div class="flex flex-col items-center justify-center py-16 text-muted-foreground">
    <p class="text-sm mb-2">Spec not found.</p>
    <a href="/specs" class="text-xs text-primary hover:underline">Back to Specs</a>
  </div>
{/if}
