<script lang="ts">
  import { Check, Copy } from 'phosphor-svelte'
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
    category: BomCategory
    kind: string
    requiredQty: number
    status: 'resolved' | 'generic' | 'incomplete'
    sources: string[]
  }

  type BomCategory = 'equipment' | 'modules' | 'cables' | 'other'

  type BomSection = {
    key: BomCategory
    title: string
    lines: BomLine[]
  }

  let copyState = $state<'idle' | 'copied' | 'failed'>('idle')

  const productsById = $derived(new Map(diagramState.products.map((p) => [p.id, p])))

  function categoryForTarget(kind: string): BomCategory {
    if (kind === 'node') return 'equipment'
    if (kind === 'link-module') return 'modules'
    if (kind === 'link-cable') return 'cables'
    return 'other'
  }

  function categoryTitle(category: BomCategory): string {
    if (category === 'equipment') return 'Equipment'
    if (category === 'modules') return 'Modules'
    if (category === 'cables') return 'Cables'
    return 'Other'
  }

  function sectionQty(lines: BomLine[]): number {
    return lines.reduce((sum, line) => sum + line.requiredQty, 0)
  }

  function actionForCategory(category: BomCategory): { label: string; path: string } {
    if (category === 'equipment')
      return { label: 'Open Materials', path: `/project/${$page.params.id}/materials` }
    return { label: 'Open Connections', path: `/project/${$page.params.id}/connections` }
  }

  function tsvCell(value: string | number): string {
    return String(value).replace(/\t/g, ' ').replace(/\r?\n/g, ' ')
  }

  function buildBomTsv(): string {
    const rows = [['Category', 'Item', 'Spec', 'Qty', 'Status', 'Sources']]
    for (const section of bomSections) {
      for (const line of section.lines) {
        rows.push([
          categoryTitle(line.category),
          line.label,
          line.kind,
          String(line.requiredQty),
          line.status,
          line.sources.join(', '),
        ])
      }
    }
    return rows.map((row) => row.map(tsvCell).join('\t')).join('\n')
  }

  async function copyBomTable() {
    if (bomLines.length === 0 || typeof navigator === 'undefined') return
    try {
      await navigator.clipboard.writeText(buildBomTsv())
      copyState = 'copied'
      setTimeout(() => {
        copyState = 'idle'
      }, 1600)
    } catch {
      copyState = 'failed'
      setTimeout(() => {
        copyState = 'idle'
      }, 2200)
    }
  }

  const bomLines = $derived.by<BomLine[]>(() => {
    const groups = new Map<string, BomLine>()
    for (const row of diagramState.assignmentRows) {
      const product = row.productId ? productsById.get(row.productId) : undefined
      const category = categoryForTarget(row.target.kind)
      const key = `${category}:${row.productId ?? row.requirementKey ?? row.id}`
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
          category,
          kind,
          requiredQty: 1,
          status: row.status,
          sources: [row.label],
        })
      }
    }
    return [...groups.values()].sort(
      (a, b) =>
        a.category.localeCompare(b.category) ||
        a.kind.localeCompare(b.kind) ||
        a.label.localeCompare(b.label),
    )
  })

  const equipmentLines = $derived(bomLines.filter((line) => line.category === 'equipment'))
  const moduleLines = $derived(bomLines.filter((line) => line.category === 'modules'))
  const cableLines = $derived(bomLines.filter((line) => line.category === 'cables'))
  const otherLines = $derived(bomLines.filter((line) => line.category === 'other'))
  const bomSections = $derived.by<BomSection[]>(() => {
    const sections: BomSection[] = [
      { key: 'equipment', title: 'Equipment', lines: equipmentLines },
      { key: 'modules', title: 'Modules', lines: moduleLines },
      { key: 'cables', title: 'Cables', lines: cableLines },
    ]
    if (otherLines.length > 0) sections.push({ key: 'other', title: 'Other', lines: otherLines })
    return sections
  })

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
  <div class="flex items-center gap-2">
    <Button variant="outline" size="sm" disabled={bomLines.length === 0} onclick={copyBomTable}>
      {#if copyState === 'copied'}
        <Check class="mr-1 h-3.5 w-3.5" />
        Copied
      {:else}
        <Copy class="mr-1 h-3.5 w-3.5" />
        {copyState === 'failed' ? 'Copy Failed' : 'Copy Table'}
      {/if}
    </Button>
    <Button
      variant="outline"
      size="sm"
      onclick={() => goto(`/project/${$page.params.id}/materials`)}
    >
      Open Materials
    </Button>
  </div>
</div>

<div class="mb-6 grid grid-cols-4 gap-3">
  <Card.Root>
    <Card.Content class="pt-4">
      <div class="text-xs uppercase tracking-wider text-muted-foreground">Equipment</div>
      <div class="font-mono text-2xl font-bold">{sectionQty(equipmentLines)}</div>
    </Card.Content>
  </Card.Root>
  <Card.Root>
    <Card.Content class="pt-4">
      <div class="text-xs uppercase tracking-wider text-muted-foreground">Modules</div>
      <div class="font-mono text-2xl font-bold">{sectionQty(moduleLines)}</div>
    </Card.Content>
  </Card.Root>
  <Card.Root>
    <Card.Content class="pt-4">
      <div class="text-xs uppercase tracking-wider text-muted-foreground">Cables</div>
      <div class="font-mono text-2xl font-bold">{sectionQty(cableLines)}</div>
    </Card.Content>
  </Card.Root>
  <Card.Root>
    <Card.Content class="pt-4">
      <div class="text-xs uppercase tracking-wider text-muted-foreground">Needs Review</div>
      <div class="font-mono text-2xl font-bold text-amber-600">
        {genericCount + incompleteCount}
      </div>
    </Card.Content>
  </Card.Root>
</div>

{#if bomLines.length > 0}
  <Card.Root class="py-0">
    <Table.Root>
      <Table.Header>
        <Table.Row>
          <Table.Head>Item</Table.Head>
          <Table.Head>Spec</Table.Head>
          <Table.Head class="text-right">Qty</Table.Head>
          <Table.Head>Status</Table.Head>
          <Table.Head>Sources</Table.Head>
          <Table.Head class="w-36"></Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each bomSections as section}
          <Table.Row class="bg-muted/50 hover:bg-muted/50">
            <Table.Cell colspan={6}>
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span
                    class="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    {section.title}
                  </span>
                  <Badge variant="secondary" class="font-mono">{sectionQty(section.lines)}</Badge>
                </div>
                {#if section.lines.length === 0}
                  <span class="text-xs text-muted-foreground"
                    >No {section.title.toLowerCase()} requirements</span
                  >
                {/if}
              </div>
            </Table.Cell>
          </Table.Row>
          {#each section.lines as line}
            {@const action = actionForCategory(line.category)}
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
                <Button variant="ghost" size="sm" onclick={() => goto(action.path)}>
                  {action.label}
                </Button>
              </Table.Cell>
            </Table.Row>
          {/each}
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
