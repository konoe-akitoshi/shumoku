<script lang="ts">
  import {
    defaultMediumForLink,
    type Link,
    type LinkEndpoint,
    newId,
    type PlugSpec,
    validateLinkCompatibility,
  } from '@shumoku/core'
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

  interface PortOption {
    id: string
    label: string
    faceplateLabel: string
    role: string
    speed: string
    cage: string
    interfaceName: string
    poe: boolean
    disabled: boolean
    usage: string[]
  }

  // Concrete ports grouped by node. These come from Node.ports snapshots,
  // not from resolved render ports, so unused ports are visible too.
  const portsByNode = $derived.by(() => {
    const groups = new Map<string, PortOption[]>()
    for (const [nodeId, node] of diagramState.nodes) {
      const usage = diagramState.getPortUsage(nodeId)
      const ports = (node.ports ?? []).map((port) => ({
        id: port.id,
        label: port.label,
        faceplateLabel: port.faceplateLabel ?? '',
        role: String(port.role ?? ''),
        speed: port.speed ?? '',
        cage: port.cage ?? '',
        interfaceName: port.interfaceName ?? '',
        poe: port.poe ?? false,
        disabled: port.disabled ?? false,
        usage: usage.get(port.id) ?? [],
      }))
      if (ports.length > 0) groups.set(nodeId, ports)
    }
    return groups
  })

  // Port options for a given node (for select dropdowns)
  function getPortOptions(nodeId: string) {
    return portsByNode.get(nodeId) ?? []
  }

  function getPortLabel(p: PortOption) {
    const label = p.label || p.cage || 'unnamed port'
    const attrs = [
      p.faceplateLabel && p.faceplateLabel !== p.label ? `panel ${p.faceplateLabel}` : '',
      p.speed,
      p.cage,
      p.poe ? 'PoE' : '',
      p.usage.length > 0 ? 'used' : '',
    ]
      .filter(Boolean)
      .join(', ')
    return attrs ? `${label} (${attrs})` : label
  }

  function hasPortOption(nodeId: string, portId: string) {
    if (!portId) return true
    return getPortOptions(nodeId).some((p) => p.id === portId)
  }

  function displayPort(nodeId: string, portId: string) {
    const port = getPortOptions(nodeId).find((p) => p.id === portId)
    return port ? getPortLabel(port) : portId
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
    medium: string
    mediumIssue: string
    fromIp: string
    toIp: string
    label: string
    type: string
  }

  const rows = $derived.by<ConnectionRow[]>(() => {
    return diagramState.links.map((link, i) => {
      const { from, to } = link
      const rawFromIp = from.ip
      const rawToIp = to.ip
      return {
        link,
        id: link.id ?? `link-${i}`,
        fromNode: from.node,
        fromPort: from.port,
        toNode: to.node,
        toPort: to.port,
        bandwidth: link.bandwidth !== undefined ? String(link.bandwidth) : '',
        vlan: link.vlan
          ? Array.isArray(link.vlan)
            ? link.vlan.join(', ')
            : String(link.vlan)
          : '',
        medium: formatMedium(link.medium),
        mediumIssue: getMediumIssue(link),
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

  const totalPorts = $derived(
    [...portsByNode.values()].reduce((sum, ports) => sum + ports.length, 0),
  )

  // Ports with no connection
  const unconnectedPorts = $derived.by(() => {
    const result: { nodeId: string; nodeLabel: string; portLabel: string; side: string }[] = []
    for (const [nodeId, ports] of portsByNode) {
      const node = nodeOptions.find((n) => n.id === nodeId)
      for (const port of ports) {
        if (port.usage.length === 0) {
          result.push({
            nodeId,
            nodeLabel: node?.label ?? nodeId,
            portLabel: port.label,
            side: port.role,
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
  let addMedium = $state('')

  const newPortOptions = [
    ['__new:rj45:1g', 'New unnamed RJ45 1G'],
    ['__new:sfp:1g', 'New unnamed SFP 1G'],
    ['__new:sfp+:10g', 'New unnamed SFP+ 10G'],
    ['__new:sfp28:25g', 'New unnamed SFP28 25G'],
    ['__new:qsfp+:40g', 'New unnamed QSFP+ 40G'],
    ['__new:qsfp28:100g', 'New unnamed QSFP28 100G'],
  ] as const

  /**
   * Resolve the form's port-select value to (port id, plug spec). For
   * "__new:..." sentinels we materialize a port on the node first; the
   * resulting LinkEndpoint always references a real port.
   */
  function resolveSelectedPort(
    nodeId: string,
    value: string,
  ): { portId: string; plug: PlugSpec } | null {
    if (!value) {
      // No selection — create a generic blank port with no cage hint.
      const portId = diagramState.addNodePort(nodeId, { label: '', source: 'custom' })
      return portId ? { portId, plug: {} } : null
    }
    if (!value.startsWith('__new:')) {
      const port = diagramState.nodes.get(nodeId)?.ports?.find((p) => p.id === value)
      return { portId: value, plug: { connector: port?.cage, speed: port?.speed } }
    }
    const [, cage, speed] = value.split(':')
    const portId = diagramState.addNodePort(nodeId, {
      label: '',
      cage,
      speed,
      poe: cage === 'rj45' ? undefined : false,
      source: 'custom',
    })
    return portId ? { portId, plug: { connector: cage, speed } } : null
  }

  function handleAdd() {
    if (!addFromNode || !addToNode || addFromNode === addToNode) return
    const fromResolved = resolveSelectedPort(addFromNode, addFromPort)
    const toResolved = resolveSelectedPort(addToNode, addToPort)
    if (!fromResolved || !toResolved) return
    const from: LinkEndpoint = {
      node: addFromNode,
      port: fromResolved.portId,
      plug: fromResolved.plug,
    }
    const to: LinkEndpoint = { node: addToNode, port: toResolved.portId, plug: toResolved.plug }
    diagramState.addLink({
      id: newId('link'),
      from,
      to,
      medium: parseMedium(addMedium) ?? inferMedium(from, to),
    })
    addFromNode = ''
    addFromPort = ''
    addToNode = ''
    addToPort = ''
    addMedium = ''
  }

  // =========================================================================
  // Inline edit
  // =========================================================================

  function updateEndpoint(link: Link, side: 'from' | 'to', field: 'port' | 'ip', value: string) {
    if (!link.id) return
    const current = link[side]
    if (field === 'port' && !value) {
      // Clearing a port is not a legal state — synthesize a fresh one
      // on the same node so the invariant survives.
      const newPortId = diagramState.addNodePort(current.node, { label: '', source: 'custom' })
      if (!newPortId) return
      diagramState.updateLink(link.id, { [side]: { ...current, port: newPortId } })
      return
    }
    const updated: LinkEndpoint = {
      ...current,
      [field]: field === 'port' ? value : value || undefined,
    }
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
    } else if (field === 'medium') {
      diagramState.updateLink(link.id, { medium: parseMedium(value) })
    }
  }

  function getPort(nodeId: string, portId: string) {
    return diagramState.nodes.get(nodeId)?.ports?.find((port) => port.id === portId)
  }

  function inferMedium(from: LinkEndpoint, to: LinkEndpoint) {
    const medium = defaultMediumForLink(
      getPort(from.node, from.port),
      getPort(to.node, to.port),
      from.plug,
      to.plug,
    )
    return Object.keys(medium).length > 0 ? medium : undefined
  }

  function parseMedium(value: string): Link['medium'] {
    if (!value) return undefined
    if (value === 'twisted-pair') return { kind: 'twisted-pair' }
    if (value === 'cat5e' || value === 'cat6' || value === 'cat6a') {
      return { kind: 'twisted-pair', cableCategory: value }
    }
    if (value === 'fiber-sm') return { kind: 'fiber', fiberMode: 'singlemode' }
    if (value === 'fiber-mm') return { kind: 'fiber', fiberMode: 'multimode' }
    if (value === 'dac' || value === 'aoc' || value === 'fiber') return { kind: value }
    return { kind: value }
  }

  function formatMedium(medium: Link['medium']) {
    if (!medium?.kind) return ''
    if (medium.kind === 'twisted-pair') return medium.cableCategory ?? 'twisted-pair'
    if (medium.kind === 'fiber' && medium.fiberMode === 'singlemode') return 'fiber-sm'
    if (medium.kind === 'fiber' && medium.fiberMode === 'multimode') return 'fiber-mm'
    return medium.kind
  }

  function getMediumIssue(link: Link) {
    const issues = validateLinkCompatibility(
      getPort(link.from.node, link.from.port),
      getPort(link.to.node, link.to.port),
      link.from.plug,
      link.to.plug,
      link.medium,
    )
    return issues[0]?.message ?? ''
  }

  const cellInput =
    'w-full px-1.5 py-0.5 text-[11px] font-mono bg-transparent border border-transparent hover:border-input focus:border-input rounded outline-none focus:ring-1 focus:ring-ring'

  const mediumOptions = [
    ['', 'Auto'],
    ['cat5e', 'Cat5e'],
    ['cat6', 'Cat6'],
    ['cat6a', 'Cat6A'],
    ['fiber-mm', 'Fiber MM'],
    ['fiber-sm', 'Fiber SM'],
    ['dac', 'DAC'],
    ['aoc', 'AOC'],
  ] as const
</script>

<div class="flex items-center justify-between mb-6">
  <div>
    <h1 class="text-lg font-semibold">Connections</h1>
    <p class="text-sm text-muted-foreground">
      {rows.length}
      links, {totalPorts} ports{vlanSet.size > 0 ? `, ${vlanSet.size} VLANs` : ''}
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
      <div class="text-2xl font-mono font-bold">{totalPorts}</div>
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
          <option value="">New unnamed port</option>
          {#each getPortOptions(addFromNode) as p}
            <option value={p.id} disabled={p.disabled}>{getPortLabel(p)}</option>
          {/each}
          {#each newPortOptions as [ value, label ]}
            <option {value}>{label}</option>
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
          <option value="">New unnamed port</option>
          {#each getPortOptions(addToNode) as p}
            <option value={p.id} disabled={p.disabled}>{getPortLabel(p)}</option>
          {/each}
          {#each newPortOptions as [ value, label ]}
            <option {value}>{label}</option>
          {/each}
        </select>
      </div>
      <div class="w-28">
        <label class="text-[10px] text-muted-foreground mb-1 block" for="add-medium">Medium</label>
        <select
          id="add-medium"
          class="w-full px-2 py-1.5 text-xs bg-background border border-input rounded-lg outline-none focus:ring-1 focus:ring-ring"
          bind:value={addMedium}
        >
          {#each mediumOptions as [ value, label ]}
            <option {value}>{label}</option>
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
          <Table.Head class="w-28">Medium</Table.Head>
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
                {#if getPortOptions(row.fromNode).length > 0}
                  <select
                    class={cellInput}
                    value={row.fromPort}
                    onchange={(e) => updateEndpoint(row.link, 'from', 'port', (e.target as HTMLSelectElement).value)}
                  >
                    <option value="">New unnamed port</option>
                    {#if row.fromPort && !hasPortOption(row.fromNode, row.fromPort)}
                      <option value={row.fromPort}>
                        {displayPort(row.fromNode, row.fromPort)}
                        (custom)
                      </option>
                    {/if}
                    {#each getPortOptions(row.fromNode) as p}
                      <option value={p.id} disabled={p.disabled}>{getPortLabel(p)}</option>
                    {/each}
                  </select>
                {:else}
                  <input
                    type="text"
                    class={cellInput}
                    value={row.fromPort}
                    placeholder="port"
                    onblur={(e) => updateEndpoint(row.link, 'from', 'port', (e.target as HTMLInputElement).value)}
                    onkeydown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                  >
                {/if}
              </div>
            </Table.Cell>
            <Table.Cell>
              <div class="font-mono text-xs">
                <span class="font-medium">{row.toNode}</span>
                {#if getPortOptions(row.toNode).length > 0}
                  <select
                    class={cellInput}
                    value={row.toPort}
                    onchange={(e) => updateEndpoint(row.link, 'to', 'port', (e.target as HTMLSelectElement).value)}
                  >
                    <option value="">New unnamed port</option>
                    {#if row.toPort && !hasPortOption(row.toNode, row.toPort)}
                      <option value={row.toPort}>
                        {displayPort(row.toNode, row.toPort)}
                        (custom)
                      </option>
                    {/if}
                    {#each getPortOptions(row.toNode) as p}
                      <option value={p.id} disabled={p.disabled}>{getPortLabel(p)}</option>
                    {/each}
                  </select>
                {:else}
                  <input
                    type="text"
                    class={cellInput}
                    value={row.toPort}
                    placeholder="port"
                    onblur={(e) => updateEndpoint(row.link, 'to', 'port', (e.target as HTMLInputElement).value)}
                    onkeydown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                  >
                {/if}
              </div>
            </Table.Cell>
            <Table.Cell>
              <select
                class="px-1 py-0.5 text-[11px] font-mono bg-transparent border border-transparent hover:border-input focus:border-input rounded outline-none focus:ring-1 focus:ring-ring"
                value={row.medium}
                title={row.mediumIssue}
                onchange={(e) => updateField(row.link, 'medium', (e.target as HTMLSelectElement).value)}
              >
                {#each mediumOptions as [ value, label ]}
                  <option {value}>{label}</option>
                {/each}
              </select>
              {#if row.mediumIssue}
                <div class="text-[9px] text-amber-600 max-w-36 truncate" title={row.mediumIssue}>
                  {row.mediumIssue}
                </div>
              {/if}
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
                    (r.fromNode === node.id && r.fromPort === port.id) ||
                    (r.toNode === node.id && r.toPort === port.id),
                )}
                <div
                  class="flex items-center justify-between px-2 py-1 rounded text-[10px] {connected ? 'bg-emerald-50 dark:bg-emerald-900/10' : 'bg-neutral-50 dark:bg-neutral-800'}"
                >
                  <span
                    class="font-mono font-medium {connected ? 'text-emerald-700 dark:text-emerald-400' : 'text-neutral-500'}"
                  >
                    {getPortLabel(port)}
                  </span>
                  <span class="text-muted-foreground">{port.cage || port.speed || 'port'}</span>
                </div>
              {/each}
            </div>
          </Card.Content>
        </Card.Root>
      {/if}
    {/each}
  </div>
{/if}
