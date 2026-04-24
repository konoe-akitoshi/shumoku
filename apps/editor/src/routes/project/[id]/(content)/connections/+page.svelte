<script lang="ts">
  import { type Link, type LinkEndpoint, newId } from '@shumoku/core'
  import { Plus, Trash } from 'phosphor-svelte'
  import { Badge } from '$lib/components/ui/badge'
  import { Button } from '$lib/components/ui/button'
  import * as Card from '$lib/components/ui/card'
  import * as Table from '$lib/components/ui/table'
  import { diagramState } from '$lib/context.svelte'

  // =========================================================================
  // Derived: nodes, ports, connections
  // =========================================================================

  const nodeOptions = $derived(
    [...diagramState.nodes.values()].map((rn) => ({
      id: rn.id,
      label: Array.isArray(rn.label) ? rn.label[0] : (rn.label ?? rn.id),
    })),
  )

  // Ports grouped by node
  const portsByNode = $derived.by(() => {
    const groups = new Map<string, { id: string; label: string; side: string }[]>()
    for (const [_id, port] of diagramState.ports) {
      const nodeId = port.nodeId
      if (!nodeId) continue
      const arr = groups.get(nodeId) ?? []
      arr.push({ id: _id, label: port.label ?? _id, side: port.side ?? '' })
      groups.set(nodeId, arr)
    }
    return groups
  })

  // Port options for a given node (for select dropdowns)
  function getPortOptions(nodeId: string) {
    return portsByNode.get(nodeId) ?? []
  }

  // Connection rows
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
        bandwidth: link.bandwidth !== undefined ? String(link.bandwidth) : '',
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

  // =========================================================================
  // Summaries
  // =========================================================================

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

  // Per-node connection count
  const nodeConnectionCounts = $derived.by(() => {
    const counts = new Map<string, number>()
    for (const row of rows) {
      counts.set(row.fromNode, (counts.get(row.fromNode) ?? 0) + 1)
      counts.set(row.toNode, (counts.get(row.toNode) ?? 0) + 1)
    }
    return counts
  })

  // Ports with no connection
  const unconnectedPorts = $derived.by(() => {
    const connectedPorts = new Set<string>()
    for (const row of rows) {
      if (row.fromPort) connectedPorts.add(`${row.fromNode}:${row.fromPort}`)
      if (row.toPort) connectedPorts.add(`${row.toNode}:${row.toPort}`)
    }
    const result: { nodeId: string; nodeLabel: string; portLabel: string; side: string }[] = []
    for (const [nodeId, ports] of portsByNode) {
      const node = nodeOptions.find((n) => n.id === nodeId)
      for (const port of ports) {
        if (!connectedPorts.has(`${nodeId}:${port.label}`)) {
          result.push({
            nodeId,
            nodeLabel: node?.label ?? nodeId,
            portLabel: port.label,
            side: port.side,
          })
        }
      }
    }
    return result
  })

  // =========================================================================
  // Add connection
  // =========================================================================

  let addFromNode = $state('')
  let addFromPort = $state('')
  let addToNode = $state('')
  let addToPort = $state('')

  function handleAdd() {
    if (!addFromNode || !addToNode || addFromNode === addToNode) return
    const from: LinkEndpoint = { node: addFromNode, port: addFromPort || undefined }
    const to: LinkEndpoint = { node: addToNode, port: addToPort || undefined }
    diagramState.addLink({ id: newId('link'), from, to })
    addFromNode = ''
    addFromPort = ''
    addToNode = ''
    addToPort = ''
  }

  // =========================================================================
  // Inline edit
  // =========================================================================

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
      links, {diagramState.ports.size} ports{vlanSet.size > 0 ? `, ${vlanSet.size} VLANs` : ''}
    </p>
  </div>
</div>

<!-- Summary cards -->
<div class="grid grid-cols-4 gap-3 mb-6">
  <Card.Root>
    <Card.Content class="pt-4">
      <div class="text-xs uppercase tracking-wider text-muted-foreground">Links</div>
      <div class="text-2xl font-mono font-bold">{rows.length}</div>
    </Card.Content>
  </Card.Root>
  <Card.Root>
    <Card.Content class="pt-4">
      <div class="text-xs uppercase tracking-wider text-muted-foreground">Ports</div>
      <div class="text-2xl font-mono font-bold">{diagramState.ports.size}</div>
      {#if unconnectedPorts.length > 0}
        <div class="text-[10px] text-amber-600 mt-0.5">{unconnectedPorts.length} unused</div>
      {/if}
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
    <div class="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
      New Connection
    </div>
    <div class="flex items-end gap-2">
      <div class="flex-1">
        <label class="text-[10px] text-muted-foreground mb-1 block" for="add-from-node">From</label>
        <select
          id="add-from-node"
          class="w-full px-2 py-1.5 text-xs bg-background border border-input rounded-lg outline-none focus:ring-1 focus:ring-ring"
          bind:value={addFromNode}
        >
          <option value="">Node...</option>
          {#each nodeOptions as opt}
            <option value={opt.id}>{opt.label}</option>
          {/each}
        </select>
      </div>
      <div class="w-24">
        <label class="text-[10px] text-muted-foreground mb-1 block" for="add-from-port">Port</label>
        <select
          id="add-from-port"
          class="w-full px-2 py-1.5 text-xs bg-background border border-input rounded-lg outline-none focus:ring-1 focus:ring-ring"
          bind:value={addFromPort}
          disabled={!addFromNode}
        >
          <option value="">—</option>
          {#each getPortOptions(addFromNode) as p}
            <option value={p.label}>{p.label} ({p.side})</option>
          {/each}
        </select>
      </div>
      <span class="text-muted-foreground text-sm pb-1.5">→</span>
      <div class="flex-1">
        <label class="text-[10px] text-muted-foreground mb-1 block" for="add-to-node">To</label>
        <select
          id="add-to-node"
          class="w-full px-2 py-1.5 text-xs bg-background border border-input rounded-lg outline-none focus:ring-1 focus:ring-ring"
          bind:value={addToNode}
        >
          <option value="">Node...</option>
          {#each nodeOptions as opt}
            <option value={opt.id}>{opt.label}</option>
          {/each}
        </select>
      </div>
      <div class="w-24">
        <label class="text-[10px] text-muted-foreground mb-1 block" for="add-to-port">Port</label>
        <select
          id="add-to-port"
          class="w-full px-2 py-1.5 text-xs bg-background border border-input rounded-lg outline-none focus:ring-1 focus:ring-ring"
          bind:value={addToPort}
          disabled={!addToNode}
        >
          <option value="">—</option>
          {#each getPortOptions(addToNode) as p}
            <option value={p.label}>{p.label} ({p.side})</option>
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
  <h2 class="text-sm font-semibold mb-3">Cables</h2>
  <Card.Root class="py-0 mb-6">
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
  <Card.Root class="py-12 mb-6">
    <Card.Content class="flex flex-col items-center text-center text-muted-foreground">
      <p class="text-sm">No connections. Add one above or draw links on the diagram.</p>
    </Card.Content>
  </Card.Root>
{/if}

<!-- Interfaces (ports by node) -->
{#if portsByNode.size > 0}
  <h2 class="text-sm font-semibold mb-3">Interfaces</h2>
  <div class="grid grid-cols-2 gap-3 mb-6">
    {#each nodeOptions as node}
      {@const ports = portsByNode.get(node.id) ?? []}
      {@const connCount = nodeConnectionCounts.get(node.id) ?? 0}
      {#if ports.length > 0}
        <Card.Root>
          <Card.Content class="pt-4">
            <div class="flex items-center justify-between mb-2">
              <div>
                <div class="text-xs font-semibold font-mono">{node.id}</div>
                <div class="text-[10px] text-muted-foreground">{node.label}</div>
              </div>
              <Badge variant="outline" class="text-[9px]">{connCount} links</Badge>
            </div>
            <div class="space-y-1">
              {#each ports as port}
                {@const connected = rows.some(
                  (r) =>
                    (r.fromNode === node.id && r.fromPort === port.label) ||
                    (r.toNode === node.id && r.toPort === port.label),
                )}
                <div
                  class="flex items-center justify-between px-2 py-1 rounded text-[10px] {connected ? 'bg-emerald-50 dark:bg-emerald-900/10' : 'bg-neutral-50 dark:bg-neutral-800'}"
                >
                  <span
                    class="font-mono font-medium {connected ? 'text-emerald-700 dark:text-emerald-400' : 'text-neutral-500'}"
                  >
                    {port.label}
                  </span>
                  <span class="text-muted-foreground">{port.side}</span>
                </div>
              {/each}
            </div>
          </Card.Content>
        </Card.Root>
      {/if}
    {/each}
  </div>
{/if}
