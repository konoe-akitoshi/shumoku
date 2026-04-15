<script lang="ts">
  import * as Card from '$lib/components/ui/card'
  import * as Table from '$lib/components/ui/table'
  import { diagramState } from '$lib/context.svelte'
  import { deriveSpecsFromNodes, getSpecPower } from '$lib/spec-utils'

  const specs = $derived(deriveSpecsFromNodes(diagramState.nodes, diagramState.catalog))
  const totalCount = $derived(specs.reduce((s, e) => s + e.count, 0))
  const totalPower = $derived(
    specs.reduce((s, e) => s + (getSpecPower(e.catalogEntry).maxDraw ?? 0) * e.count, 0),
  )
  const totalPoeBudget = $derived(
    specs.reduce((s, e) => s + (getSpecPower(e.catalogEntry).poeBudget ?? 0) * e.count, 0),
  )
</script>

<div class="mb-6">
  <h1 class="text-lg font-semibold">Bill of Materials</h1>
  <p class="text-sm text-muted-foreground">Auto-generated from diagram nodes</p>
</div>

<div class="grid grid-cols-3 gap-3 mb-6">
  <Card.Root>
    <Card.Content class="pt-4">
      <div class="text-xs uppercase tracking-wider text-muted-foreground">Devices</div>
      <div class="text-2xl font-mono font-bold">{totalCount}</div>
      <div class="text-xs text-muted-foreground">{specs.length} unique specs</div>
    </Card.Content>
  </Card.Root>
  <Card.Root>
    <Card.Content class="pt-4">
      <div class="text-xs uppercase tracking-wider text-muted-foreground">Total Power</div>
      <div class="text-2xl font-mono font-bold">{totalPower}W</div>
      <div class="text-xs text-muted-foreground">max consumption</div>
    </Card.Content>
  </Card.Root>
  <Card.Root>
    <Card.Content class="pt-4">
      <div class="text-xs uppercase tracking-wider text-muted-foreground">PoE Budget</div>
      <div class="text-2xl font-mono font-bold">{totalPoeBudget}W</div>
      <div class="text-xs text-muted-foreground">total available</div>
    </Card.Content>
  </Card.Root>
</div>

{#if specs.length > 0}
  <Card.Root class="py-0">
    <Table.Root>
      <Table.Header>
        <Table.Row>
          <Table.Head class="w-10">#</Table.Head>
          <Table.Head>Product</Table.Head>
          <Table.Head>Vendor / Model</Table.Head>
          <Table.Head class="text-right">Qty</Table.Head>
          <Table.Head class="text-right">Unit Power</Table.Head>
          <Table.Head class="text-right">Total Power</Table.Head>
          <Table.Head class="text-right">PoE Budget</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each specs as entry, i}
          {@const power = getSpecPower(entry.catalogEntry)}
          <Table.Row>
            <Table.Cell class="text-muted-foreground">{i + 1}</Table.Cell>
            <Table.Cell class="font-medium">{entry.label}</Table.Cell>
            <Table.Cell class="font-mono text-xs text-muted-foreground">
              {entry.spec.vendor ?? '—'}
              /
              {'model' in entry.spec ? entry.spec.model ?? '—' : 'service' in entry.spec ? entry.spec.service : '—'}
            </Table.Cell>
            <Table.Cell class="text-right font-mono font-semibold">{entry.count}</Table.Cell>
            <Table.Cell class="text-right font-mono text-muted-foreground"
              >{power.maxDraw ? `${power.maxDraw}W` : '—'}</Table.Cell
            >
            <Table.Cell class="text-right font-mono"
              >{power.maxDraw ? `${power.maxDraw * entry.count}W` : '—'}</Table.Cell
            >
            <Table.Cell class="text-right font-mono"
              >{power.poeBudget ? `${power.poeBudget * entry.count}W` : '—'}</Table.Cell
            >
          </Table.Row>
        {/each}
      </Table.Body>
      <Table.Footer>
        <Table.Row>
          <Table.Cell colspan={3} class="font-semibold">Total</Table.Cell>
          <Table.Cell class="text-right font-mono font-semibold">{totalCount}</Table.Cell>
          <Table.Cell></Table.Cell>
          <Table.Cell class="text-right font-mono font-semibold">{totalPower}W</Table.Cell>
          <Table.Cell class="text-right font-mono font-semibold">{totalPoeBudget}W</Table.Cell>
        </Table.Row>
      </Table.Footer>
    </Table.Root>
  </Card.Root>
{:else}
  <Card.Root class="py-16">
    <Card.Content class="flex flex-col items-center text-center text-muted-foreground">
      <p class="text-sm">No nodes in diagram.</p>
    </Card.Content>
  </Card.Root>
{/if}
