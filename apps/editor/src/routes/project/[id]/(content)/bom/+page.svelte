<script lang="ts">
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import { Badge } from '$lib/components/ui/badge'
  import { Button } from '$lib/components/ui/button'
  import * as Card from '$lib/components/ui/card'
  import * as Table from '$lib/components/ui/table'
  import { diagramState } from '$lib/context.svelte'
  import { paletteEntryLabel } from '$lib/types'

  type BomLine = {
    key: string
    label: string
    kind: string
    requiredQty: number
    status: 'resolved' | 'generic' | 'incomplete'
    sources: string[]
  }

  const productsById = $derived(new Map(diagramState.products.map((p) => [p.id, p])))

  const bomLines = $derived.by<BomLine[]>(() => {
    const groups = new Map<string, BomLine>()
    for (const row of diagramState.assignmentRows) {
      const product = row.productId ? productsById.get(row.productId) : undefined
      const key = row.productId ?? row.requirementKey ?? row.id
      const label = product ? paletteEntryLabel(product) : (row.requirementKey ?? row.label)
      const kind = product?.spec.kind ?? row.target.kind
      const existing = groups.get(key)
      if (existing) {
        existing.requiredQty += 1
        existing.sources.push(row.label)
        if (existing.status !== 'incomplete' && row.status === 'incomplete')
          existing.status = 'incomplete'
        else if (existing.status === 'resolved' && row.status === 'generic')
          existing.status = 'generic'
      } else {
        groups.set(key, {
          key,
          label,
          kind,
          requiredQty: 1,
          status: row.status,
          sources: [row.label],
        })
      }
    }
    return [...groups.values()].sort(
      (a, b) => a.kind.localeCompare(b.kind) || a.label.localeCompare(b.label),
    )
  })

  const resolvedCount = $derived(bomLines.filter((line) => line.status === 'resolved').length)
  const genericCount = $derived(bomLines.filter((line) => line.status === 'generic').length)
  const incompleteCount = $derived(bomLines.filter((line) => line.status === 'incomplete').length)
</script>

<div class="mb-6 flex items-center justify-between">
  <div>
    <h1 class="text-lg font-semibold">BOM</h1>
    <p class="text-sm text-muted-foreground">
      Derived parts list from Diagram, Connections, and Materials assignments
    </p>
  </div>
  <Button variant="outline" size="sm" onclick={() => goto(`/project/${$page.params.id}/materials`)}>
    Open Materials
  </Button>
</div>

<div class="mb-6 grid grid-cols-4 gap-3">
  <Card.Root>
    <Card.Content class="pt-4">
      <div class="text-xs uppercase tracking-wider text-muted-foreground">Lines</div>
      <div class="font-mono text-2xl font-bold">{bomLines.length}</div>
    </Card.Content>
  </Card.Root>
  <Card.Root>
    <Card.Content class="pt-4">
      <div class="text-xs uppercase tracking-wider text-muted-foreground">Resolved</div>
      <div class="font-mono text-2xl font-bold text-green-600">{resolvedCount}</div>
    </Card.Content>
  </Card.Root>
  <Card.Root>
    <Card.Content class="pt-4">
      <div class="text-xs uppercase tracking-wider text-muted-foreground">Generic</div>
      <div class="font-mono text-2xl font-bold text-amber-600">{genericCount}</div>
    </Card.Content>
  </Card.Root>
  <Card.Root>
    <Card.Content class="pt-4">
      <div class="text-xs uppercase tracking-wider text-muted-foreground">Incomplete</div>
      <div class="font-mono text-2xl font-bold text-destructive">{incompleteCount}</div>
    </Card.Content>
  </Card.Root>
</div>

{#if bomLines.length > 0}
  <Card.Root class="py-0">
    <Table.Root>
      <Table.Header>
        <Table.Row>
          <Table.Head>Item</Table.Head>
          <Table.Head>Kind</Table.Head>
          <Table.Head class="text-right">Required</Table.Head>
          <Table.Head>Status</Table.Head>
          <Table.Head>Sources</Table.Head>
          <Table.Head class="w-24"></Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each bomLines as line}
          <Table.Row>
            <Table.Cell class="text-xs font-medium">{line.label}</Table.Cell>
            <Table.Cell><Badge variant="secondary">{line.kind}</Badge></Table.Cell>
            <Table.Cell class="text-right font-mono font-semibold">{line.requiredQty}</Table.Cell>
            <Table.Cell>
              {#if line.status === 'resolved'}
                <Badge variant="default">resolved</Badge>
              {:else if line.status === 'generic'}
                <Badge variant="secondary">generic</Badge>
              {:else}
                <Badge variant="outline">incomplete</Badge>
              {/if}
            </Table.Cell>
            <Table.Cell>
              <div class="flex flex-wrap gap-1">
                {#each line.sources.slice(0, 5) as source}
                  <Badge variant="outline" class="font-mono text-[10px]">{source}</Badge>
                {/each}
                {#if line.sources.length > 5}
                  <Badge variant="outline" class="font-mono text-[10px]"
                    >+{line.sources.length - 5}</Badge
                  >
                {/if}
              </div>
            </Table.Cell>
            <Table.Cell>
              <Button
                variant="ghost"
                size="sm"
                onclick={() => goto(`/project/${$page.params.id}/materials`)}
              >
                Assign
              </Button>
            </Table.Cell>
          </Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
  </Card.Root>
{:else}
  <Card.Root class="py-16">
    <Card.Content class="flex flex-col items-center text-center text-muted-foreground">
      <p class="mb-1 text-sm">No BOM requirements yet.</p>
      <p class="text-xs">Create nodes and connections, then assign products in Materials.</p>
    </Card.Content>
  </Card.Root>
{/if}
