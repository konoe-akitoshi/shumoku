<script lang="ts">
  import type { Link, LinkEndpoint } from '@shumoku/core'
  import { nanoid } from 'nanoid'
  import { Plus, Trash } from 'phosphor-svelte'
  import { Badge } from '$lib/components/ui/badge'
  import { Button } from '$lib/components/ui/button'
  import * as Card from '$lib/components/ui/card'
  import * as Table from '$lib/components/ui/table'
  import { diagramState } from '$lib/context.svelte'

  // All node IDs for dropdowns
  const nodeOptions = $derived(
    [...diagramState.nodes.values()].map((rn) => ({
      id: rn.id,
      label: Array.isArray(rn.node.label) ? rn.node.label[0] : (rn.node.label ?? rn.id),
    })),
  )

  // Flattened rows for table display
  interface ConnectionRow {
    link: Link
    id: string
    fromNode: string
    fromPort: string
    toNode: string
    toPort: string
    bandwidth: string
    vlan: string
    fromIp: string
    toIp: string
    label: string
    type: string
  }

  const rows = $derived.by<ConnectionRow[]>(() => {
    return diagramState.links.map((link, i) => {
      const from = typeof link.from === 'object' ? link.from : { node: link.from }
      const to = typeof link.to === 'object' ? link.to : { node: link.to }
      const rawFromIp = 'ip' in from ? from.ip : undefined
      const rawToIp = 'ip' in to ? to.ip : undefined
      return {
        link,
        id: link.id ?? `link-${i}`,
        fromNode: from.node,
        fromPort: 'port' in from ? (from.port ?? '') : '',
        toNode: to.node,
        toPort: 'port' in to ? (to.port ?? '') : '',
        bandwidth: link.bandwidth ?? '',
        vlan: link.vlan
          ? Array.isArray(link.vlan)
            ? link.vlan.join(', ')
            : String(link.vlan)
          : '',
        fromIp: rawFromIp ? (Array.isArray(rawFromIp) ? rawFromIp.join(', ') : rawFromIp) : '',
        toIp: rawToIp ? (Array.isArray(rawToIp) ? rawToIp.join(', ') : rawToIp) : '',
        label: Array.isArray(link.label) ? link.label.join(', ') : (link.label ?? ''),
        type: link.type ?? 'solid',
      }
    })
  })

  // Summary
  const bandwidthSummary = $derived.by(() => {
    const counts = new Map<string, number>()
    for (const row of rows) {
      if (row.bandwidth) {
        counts.set(row.bandwidth, (counts.get(row.bandwidth) ?? 0) + 1)
      }
    }
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  })

  const vlanSet = $derived(
    new Set(
      diagramState.links.flatMap((l) =>
        l.vlan ? (Array.isArray(l.vlan) ? l.vlan : [l.vlan]) : [],
      ),
    ),
  )

  // Add new connection
  let addFromNode = $state('')
  let addToNode = $state('')

  function handleAdd() {
    if (!addFromNode || !addToNode || addFromNode === addToNode) return
    const from: LinkEndpoint = { node: addFromNode }
    const to: LinkEndpoint = { node: addToNode }
    diagramState.addLink({ id: `link-${nanoid(8)}`, from, to })
    addFromNode = ''
    addToNode = ''
  }

  // Inline edit helpers
  function updateEndpoint(link: Link, side: 'from' | 'to', field: 'port' | 'ip', value: string) {
    if (!link.id) return
    const current = typeof link[side] === 'object' ? link[side] : { node: link[side] as string }
    const updated = { ...current, [field]: value || undefined }
    diagramState.updateLink(link.id, { [side]: updated })
  }

  function updateField(link: Link, field: string, value: string) {
    if (!link.id) return
    if (field === 'bandwidth') {
      diagramState.updateLink(link.id, { bandwidth: (value || undefined) as Link['bandwidth'] })
    } else if (field === 'vlan') {
      const vlans = value
        .split(',')
        .map((v) => Number.parseInt(v.trim(), 10))
        .filter((v) => !Number.isNaN(v))
      diagramState.updateLink(link.id, { vlan: vlans.length > 0 ? vlans : undefined })
    } else if (field === 'label') {
      diagramState.updateLink(link.id, { label: value || undefined })
    } else if (field === 'type') {
      diagramState.updateLink(link.id, { type: (value || undefined) as Link['type'] })
    }
  }

  const cellInput =
    'w-full px-1.5 py-0.5 text-[11px] font-mono bg-transparent border border-transparent hover:border-input focus:border-input rounded outline-none focus:ring-1 focus:ring-ring'
</script>

<div class="flex items-center justify-between mb-6">
  <div>
    <h1 class="text-lg font-semibold">Connections</h1>
    <p class="text-sm text-muted-foreground">
      {rows.length}
      links{vlanSet.size > 0 ? `, ${vlanSet.size} VLANs` : ''}
    </p>
  </div>
</div>

<!-- Summary cards -->
<div class="grid grid-cols-3 gap-3 mb-6">
  <Card.Root>
    <Card.Content class="pt-4">
      <div class="text-xs uppercase tracking-wider text-muted-foreground">Links</div>
      <div class="text-2xl font-mono font-bold">{rows.length}</div>
    </Card.Content>
  </Card.Root>
  <Card.Root>
    <Card.Content class="pt-4">
      <div class="text-xs uppercase tracking-wider text-muted-foreground">VLANs</div>
      <div class="text-2xl font-mono font-bold">{vlanSet.size}</div>
      {#if vlanSet.size > 0}
        <div class="flex flex-wrap gap-1 mt-1">
          {#each [...vlanSet].sort((a, b) => a - b) as v}
            <Badge variant="outline" class="text-[9px] font-mono">{v}</Badge>
          {/each}
        </div>
      {/if}
    </Card.Content>
  </Card.Root>
  <Card.Root>
    <Card.Content class="pt-4">
      <div class="text-xs uppercase tracking-wider text-muted-foreground">Bandwidth</div>
      {#if bandwidthSummary.length > 0}
        <div class="flex flex-wrap gap-1.5 mt-1">
          {#each bandwidthSummary as [ bw, count ]}
            <Badge variant="secondary" class="font-mono text-[10px]">{bw} x{count}</Badge>
          {/each}
        </div>
      {:else}
        <div class="text-2xl font-mono font-bold text-muted-foreground">—</div>
      {/if}
    </Card.Content>
  </Card.Root>
</div>

<!-- Add connection -->
<Card.Root class="mb-6">
  <Card.Content class="pt-4">
    <div class="flex items-end gap-3">
      <div class="flex-1">
        <label
          class="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block"
          for="add-from"
          >From</label
        >
        <select
          id="add-from"
          class="w-full px-2 py-1.5 text-xs bg-background border border-input rounded-lg outline-none focus:ring-1 focus:ring-ring"
          bind:value={addFromNode}
        >
          <option value="">Select node...</option>
          {#each nodeOptions as opt}
            <option value={opt.id}>{opt.id} ({opt.label})</option>
          {/each}
        </select>
      </div>
      <span class="text-muted-foreground text-sm pb-1.5">→</span>
      <div class="flex-1">
        <label
          class="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block"
          for="add-to"
          >To</label
        >
        <select
          id="add-to"
          class="w-full px-2 py-1.5 text-xs bg-background border border-input rounded-lg outline-none focus:ring-1 focus:ring-ring"
          bind:value={addToNode}
        >
          <option value="">Select node...</option>
          {#each nodeOptions as opt}
            <option value={opt.id}>{opt.id} ({opt.label})</option>
          {/each}
        </select>
      </div>
      <Button
        size="sm"
        disabled={!addFromNode || !addToNode || addFromNode === addToNode}
        onclick={handleAdd}
      >
        <Plus class="w-4 h-4 mr-1" />
        Add
      </Button>
    </div>
  </Card.Content>
</Card.Root>

<!-- Connection table -->
{#if rows.length > 0}
  <Card.Root class="py-0">
    <Table.Root>
      <Table.Header>
        <Table.Row>
          <Table.Head>From</Table.Head>
          <Table.Head>To</Table.Head>
          <Table.Head class="w-20">BW</Table.Head>
          <Table.Head class="w-24">VLAN</Table.Head>
          <Table.Head>From IP</Table.Head>
          <Table.Head>To IP</Table.Head>
          <Table.Head>Label</Table.Head>
          <Table.Head class="w-10"></Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each rows as row (row.id)}
          <Table.Row>
            <Table.Cell>
              <div class="font-mono text-xs">
                <span class="font-medium">{row.fromNode}</span>
                <input
                  type="text"
                  class={cellInput}
                  value={row.fromPort}
                  placeholder="port"
                  onblur={(e) => updateEndpoint(row.link, 'from', 'port', (e.target as HTMLInputElement).value)}
                  onkeydown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                >
              </div>
            </Table.Cell>
            <Table.Cell>
              <div class="font-mono text-xs">
                <span class="font-medium">{row.toNode}</span>
                <input
                  type="text"
                  class={cellInput}
                  value={row.toPort}
                  placeholder="port"
                  onblur={(e) => updateEndpoint(row.link, 'to', 'port', (e.target as HTMLInputElement).value)}
                  onkeydown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                >
              </div>
            </Table.Cell>
            <Table.Cell>
              <select
                class="px-1 py-0.5 text-[11px] font-mono bg-transparent border border-transparent hover:border-input focus:border-input rounded outline-none focus:ring-1 focus:ring-ring"
                value={row.bandwidth}
                onchange={(e) => updateField(row.link, 'bandwidth', (e.target as HTMLSelectElement).value)}
              >
                <option value="">—</option>
                <option value="1G">1G</option>
                <option value="10G">10G</option>
                <option value="25G">25G</option>
                <option value="40G">40G</option>
                <option value="100G">100G</option>
              </select>
            </Table.Cell>
            <Table.Cell>
              <input
                type="text"
                class={cellInput}
                value={row.vlan}
                placeholder="—"
                onblur={(e) => updateField(row.link, 'vlan', (e.target as HTMLInputElement).value)}
                onkeydown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
              >
            </Table.Cell>
            <Table.Cell>
              <input
                type="text"
                class={cellInput}
                value={row.fromIp}
                placeholder="—"
                onblur={(e) => updateEndpoint(row.link, 'from', 'ip', (e.target as HTMLInputElement).value)}
                onkeydown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
              >
            </Table.Cell>
            <Table.Cell>
              <input
                type="text"
                class={cellInput}
                value={row.toIp}
                placeholder="—"
                onblur={(e) => updateEndpoint(row.link, 'to', 'ip', (e.target as HTMLInputElement).value)}
                onkeydown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
              >
            </Table.Cell>
            <Table.Cell>
              <input
                type="text"
                class={cellInput}
                value={row.label}
                placeholder="—"
                onblur={(e) => updateField(row.link, 'label', (e.target as HTMLInputElement).value)}
                onkeydown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
              >
            </Table.Cell>
            <Table.Cell>
              <Button
                variant="ghost"
                size="icon"
                class="h-7 w-7"
                onclick={() => { if (row.link.id) diagramState.removeLink(row.link.id) }}
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
  <Card.Root class="py-16">
    <Card.Content class="flex flex-col items-center text-center text-muted-foreground">
      <p class="text-sm">No connections. Add one above or draw links on the diagram.</p>
    </Card.Content>
  </Card.Root>
{/if}
