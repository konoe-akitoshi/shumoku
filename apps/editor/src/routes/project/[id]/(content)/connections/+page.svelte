<script lang="ts">
  import {
    type CableGrade,
    cableGradesForStandard,
    defaultCableGrade,
    defaultStandardForCages,
    type EthernetStandard,
    endpointStandard,
    issuesForTarget,
    type Link,
    type LinkEndpoint,
    newId,
    plugFromStandard,
    type ValidationIssue,
    validateLinkCompatibility,
  } from '@shumoku/core'
  import { Info, MagnifyingGlass, Plus, Trash, Warning, WarningCircle } from 'phosphor-svelte'
  import EndpointModulePicker from '$lib/components/EndpointModulePicker.svelte'
  import IssuesBanner, { type RowIssue } from '$lib/components/IssuesBanner.svelte'
  import PortPicker from '$lib/components/PortPicker.svelte'
  import StandardImpliedBlock from '$lib/components/StandardImpliedBlock.svelte'
  import { Badge } from '$lib/components/ui/badge'
  import { Button } from '$lib/components/ui/button'
  import * as Card from '$lib/components/ui/card'
  import * as Table from '$lib/components/ui/table'
  import ValidationCell from '$lib/components/ValidationCell.svelte'
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

  // Connection rows
  interface ConnectionRow {
    link: Link
    id: string
    fromNode: string
    fromPort: string
    toNode: string
    toPort: string
    standard: string
    issues: ValidationIssue[]
    cableLength: string
    vlan: string
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
        standard: endpointStandard(link.from) ?? endpointStandard(link.to) ?? '',
        issues: validateLinkCompatibility(
          getPort(link.from.node, link.from.port),
          getPort(link.to.node, link.to.port),
          link,
        ),
        cableLength: link.cable?.length_m !== undefined ? String(link.cable.length_m) : '',
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

  const standardSummary = $derived.by(() => {
    const counts = new Map<string, number>()
    for (const row of rows) {
      if (row.standard) {
        counts.set(row.standard, (counts.get(row.standard) ?? 0) + 1)
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

  // All issues flattened with link context — drives the issues banner.
  const allRowIssues = $derived<RowIssue[]>(
    rows.flatMap((row) =>
      row.issues.map((issue) => ({
        rowId: row.id,
        from: row.fromNode,
        to: row.toNode,
        issue,
      })),
    ),
  )

  const issueCounts = $derived.by(() => {
    let errors = 0
    let warnings = 0
    let info = 0
    for (const row of rows) {
      for (const issue of row.issues) {
        if (issue.severity === 'error') errors++
        else if (issue.severity === 'warning') warnings++
        else info++
      }
    }
    return { errors, warnings, info, total: errors + warnings + info }
  })

  let searchQuery = $state('')
  let showOnlyIssues = $state(false)

  function rowMatchesSearch(row: ConnectionRow, query: string) {
    const q = query.trim().toLowerCase()
    if (!q) return true
    const fromPort = getPort(row.fromNode, row.fromPort)
    const toPort = getPort(row.toNode, row.toPort)
    return [
      row.id,
      row.fromNode,
      row.toNode,
      row.fromPort,
      row.toPort,
      fromPort?.label,
      fromPort?.interfaceName,
      fromPort?.cage,
      toPort?.label,
      toPort?.interfaceName,
      toPort?.cage,
      row.standard,
      row.vlan,
      row.fromIp,
      row.toIp,
      row.label,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(q))
  }

  const visibleRows = $derived(
    rows.filter(
      (row) => (!showOnlyIssues || row.issues.length > 0) && rowMatchesSearch(row, searchQuery),
    ),
  )

  // Jump to a specific row in the connections table — scroll into view
  // and briefly highlight to draw the eye.
  let highlightedRowId = $state<string | null>(null)

  function jumpToRow(rowId: string) {
    const el = document.getElementById(`connection-row-${rowId}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    highlightedRowId = rowId
    setTimeout(() => {
      if (highlightedRowId === rowId) highlightedRowId = null
    }, 1500)
  }

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

  // Add-form state. PortPicker creates a NodePort eagerly when the user
  // picks/types in the dropdown, so we always carry a real port id (or
  // empty when not yet picked). Modules are per-endpoint; default
  // symmetric — once both ports are chosen we pre-fill both sides with
  // the suggested standard, and any user edit on one side mirrors to
  // the other while it's still empty or matched.
  let addFromNode = $state('')
  let addFromPortId = $state('')
  let addToNode = $state('')
  let addToPortId = $state('')
  let addFromStandard = $state<EthernetStandard | ''>('')
  let addToStandard = $state<EthernetStandard | ''>('')
  let addCableCategory = $state<CableGrade | undefined>(undefined)

  const addFromCage = $derived(getPort(addFromNode, addFromPortId)?.cage)
  const addToCage = $derived(getPort(addToNode, addToPortId)?.cage)
  const addReferenceStandard = $derived<EthernetStandard | undefined>(
    (addFromStandard || addToStandard || undefined) as EthernetStandard | undefined,
  )
  const addGradeOptions = $derived(cableGradesForStandard(addReferenceStandard))

  const addDraftLink = $derived.by<Link | undefined>(() => {
    if (!addFromNode || !addToNode || !addFromPortId || !addToPortId) return undefined
    return {
      from: {
        node: addFromNode,
        port: addFromPortId,
        plug: addFromStandard ? plugFromStandard(addFromStandard) : undefined,
      },
      to: {
        node: addToNode,
        port: addToPortId,
        plug: addToStandard ? plugFromStandard(addToStandard) : undefined,
      },
      cable: addCableCategory ? { category: addCableCategory } : undefined,
    }
  })

  const addDraftIssues = $derived(
    addDraftLink
      ? validateLinkCompatibility(
          getPort(addDraftLink.from.node, addDraftLink.from.port),
          getPort(addDraftLink.to.node, addDraftLink.to.port),
          addDraftLink,
        )
      : [],
  )

  // Auto-default both endpoints once both ports are picked, unless the
  // user has already set at least one side.
  $effect(() => {
    if (addFromStandard || addToStandard) return
    if (!addFromPortId || !addToPortId) return
    const proposed = defaultStandardForCages(addFromCage, addToCage)
    if (proposed) {
      addFromStandard = proposed
      addToStandard = proposed
    }
  })

  function setAddStandard(side: 'from' | 'to', value: EthernetStandard | undefined) {
    if (side === 'from') {
      const wasSymmetric = !addToStandard || addToStandard === addFromStandard
      addFromStandard = (value ?? '') as EthernetStandard | ''
      if (wasSymmetric) addToStandard = addFromStandard
    } else {
      const wasSymmetric = !addFromStandard || addFromStandard === addToStandard
      addToStandard = (value ?? '') as EthernetStandard | ''
      if (wasSymmetric) addFromStandard = addToStandard
    }
  }

  function handleAdd() {
    if (!addFromNode || !addToNode || addFromNode === addToNode) return
    if (!addFromPortId || !addToPortId) return
    const fromPlug = addFromStandard ? plugFromStandard(addFromStandard) : undefined
    const toPlug = addToStandard ? plugFromStandard(addToStandard) : undefined
    const from: LinkEndpoint = { node: addFromNode, port: addFromPortId, plug: fromPlug }
    const to: LinkEndpoint = { node: addToNode, port: addToPortId, plug: toPlug }
    diagramState.addLink({
      id: newId('link'),
      from,
      to,
      cable: addCableCategory ? { category: addCableCategory } : undefined,
    })
    addFromNode = ''
    addFromPortId = ''
    addToNode = ''
    addToPortId = ''
    addFromStandard = ''
    addToStandard = ''
    addCableCategory = undefined
  }

  // =========================================================================
  // Inline edit
  // =========================================================================

  function updateEndpointPort(link: Link, side: 'from' | 'to', portId: string) {
    if (!link.id) return
    const current = link[side]
    diagramState.updateLink(link.id, { [side]: { ...current, port: portId } })
  }

  function updateEndpointIp(link: Link, side: 'from' | 'to', value: string) {
    if (!link.id) return
    const current = link[side]
    diagramState.updateLink(link.id, { [side]: { ...current, ip: value || undefined } })
  }

  /**
   * Per-endpoint module standard. Mirrors symmetrically by default —
   * picking on one side updates the other when the other end was empty
   * or already matched the previous value. Once the user has explicitly
   * diverged (asymmetric BiDi etc.), each side is independent.
   */
  function updateEndpointModuleStandard(
    link: Link,
    side: 'from' | 'to',
    standard: EthernetStandard | undefined,
  ) {
    if (!link.id) return
    const other = side === 'from' ? 'to' : 'from'
    const current = link[side]
    const otherEp = link[other]
    const currentStd = endpointStandard(current)
    const otherStd = endpointStandard(otherEp)
    const wasSymmetric = !otherStd || otherStd === currentStd
    const newPlug = standard ? plugFromStandard(standard, current.plug?.module?.sku) : undefined
    const updates: Partial<Link> = { [side]: { ...current, plug: newPlug } }
    if (wasSymmetric) {
      const newOtherPlug = standard
        ? plugFromStandard(standard, otherEp.plug?.module?.sku)
        : undefined
      updates[other] = { ...otherEp, plug: newOtherPlug }
    }
    const grades = cableGradesForStandard(standard)
    const currentGrade = link.cable?.category
    const gradeFits = currentGrade && grades.some((g) => g.value === currentGrade)
    if (!gradeFits) {
      const next = { ...(link.cable ?? {}) }
      const def = defaultCableGrade(standard)
      if (def) next.category = def
      else delete next.category
      updates.cable = Object.keys(next).length > 0 ? next : undefined
    }
    diagramState.updateLink(link.id, updates)
  }

  function updateCableCategory(link: Link, category: CableGrade | undefined) {
    if (!link.id) return
    const next = { ...(link.cable ?? {}) }
    if (category) next.category = category
    else delete next.category
    diagramState.updateLink(link.id, {
      cable: Object.keys(next).length > 0 ? next : undefined,
    })
  }

  function updateField(link: Link, field: string, value: string) {
    if (!link.id) return
    if (field === 'cableLength') {
      const length = value ? Number.parseFloat(value) : undefined
      const next = { ...(link.cable ?? {}) }
      if (length === undefined || !Number.isFinite(length)) delete next.length_m
      else next.length_m = length
      diagramState.updateLink(link.id, {
        cable: Object.keys(next).length > 0 ? next : undefined,
      })
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

  function getPort(nodeId: string, portId: string) {
    return diagramState.nodes.get(nodeId)?.ports?.find((port) => port.id === portId)
  }

  const cellInput =
    'w-full px-1.5 py-0.5 text-[11px] font-mono bg-transparent border border-transparent hover:border-input focus:border-input rounded outline-none focus:ring-1 focus:ring-ring'
</script>

<div class="mb-4 space-y-3">
  <div class="flex flex-wrap items-center justify-between gap-3">
    <div>
      <h1 class="text-lg font-semibold">Connections</h1>
      <p class="text-sm text-muted-foreground">Cable inventory and endpoint assignment</p>
    </div>
  </div>

  <div class="flex flex-wrap items-center gap-2 text-xs">
    <Badge variant="secondary" class="font-mono">{rows.length} links</Badge>
    <Badge variant="outline" class="font-mono">{totalPorts} ports</Badge>
    {#if issueCounts.errors > 0}
      <Badge variant="destructive" class="font-mono">{issueCounts.errors} errors</Badge>
    {/if}
    {#if issueCounts.warnings > 0}
      <Badge
        variant="outline"
        class="border-amber-300 text-amber-700 dark:text-amber-300 font-mono"
      >
        {issueCounts.warnings}
        warnings
      </Badge>
    {/if}
    {#if unconnectedPorts.length > 0}
      <Badge variant="outline" class="font-mono">{unconnectedPorts.length} unused ports</Badge>
    {/if}
    {#if vlanSet.size > 0}
      <Badge variant="outline" class="font-mono">{vlanSet.size} VLANs</Badge>
    {/if}
    {#each standardSummary.slice(0, 4) as [ s, count ]}
      <Badge variant="secondary" class="font-mono">{s} x{count}</Badge>
    {/each}
    {#if standardSummary.length > 4}
      <Badge variant="outline" class="font-mono">+{standardSummary.length - 4} standards</Badge>
    {/if}
  </div>
</div>

<!-- Add connection -->
<Card.Root class="mb-5">
  <Card.Content class="pt-4">
    <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
      <div>
        <div class="text-[10px] uppercase tracking-wider text-muted-foreground">New Connection</div>
        <div class="text-xs text-muted-foreground">
          Pick endpoints or link type first; the rest stays constrained by the current selection.
        </div>
      </div>
      <Button
        size="sm"
        disabled={!addFromNode || !addToNode || addFromNode === addToNode || !addFromPortId || !addToPortId}
        onclick={handleAdd}
      >
        <Plus class="w-4 h-4 mr-1" />
        Add
      </Button>
    </div>

    <div class="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(16rem,0.7fr)_minmax(0,1fr)]">
      <div class="space-y-2">
        <div class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          A end
        </div>
        <div class="grid gap-2 md:grid-cols-[minmax(8rem,0.9fr)_minmax(8rem,1fr)]">
          <div>
            <label class="text-[10px] text-muted-foreground mb-1 block" for="add-from-node">
              Node
            </label>
            <select
              id="add-from-node"
              class="w-full px-2 py-1.5 text-xs bg-background border border-input rounded-md outline-none focus:ring-1 focus:ring-ring"
              bind:value={addFromNode}
            >
              <option value="">Node...</option>
              {#each nodeOptions as opt}
                <option value={opt.id}>{opt.label}</option>
              {/each}
            </select>
          </div>
          <div>
            <span class="text-[10px] text-muted-foreground mb-1 block">Port</span>
            <PortPicker
              nodeId={addFromNode}
              value={addFromPortId}
              disabled={!addFromNode}
              onchange={(portId) => {
                addFromPortId = portId
              }}
            />
          </div>
        </div>
        <div>
          <span class="text-[10px] text-muted-foreground mb-1 block">Plug / Module</span>
          <EndpointModulePicker
            class="w-full px-2 py-1.5 text-xs bg-background border border-input rounded-md outline-none focus:ring-1 focus:ring-ring"
            cage={addFromCage}
            standard={addFromStandard || undefined}
            disabled={!addFromPortId}
            onchange={(v) => setAddStandard('from', v)}
          />
        </div>
      </div>

      <div class="space-y-2 border-y border-border py-3 xl:border-x xl:border-y-0 xl:px-3 xl:py-0">
        <div class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Link
        </div>
        <div>
          <span class="text-[10px] text-muted-foreground mb-1 block">Cable</span>
          <select
            class="w-full px-2 py-1.5 text-xs bg-background border border-input rounded-md outline-none focus:ring-1 focus:ring-ring"
            disabled={addGradeOptions.length === 0}
            value={addCableCategory ?? ''}
            onchange={(e) => {
              const v = (e.target as HTMLSelectElement).value
              addCableCategory = v ? (v as CableGrade) : undefined
            }}
          >
            <option value="">—</option>
            {#each addGradeOptions as g}
              <option value={g.value}>{g.label}</option>
            {/each}
          </select>
        </div>
        {#if addReferenceStandard}
          <div class="mt-3">
            <StandardImpliedBlock
              standard={addReferenceStandard}
              cable={addCableCategory ? { category: addCableCategory } : undefined}
              fromCage={addFromCage}
              toCage={addToCage}
            />
          </div>
        {:else}
          <div
            class="mt-3 rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground"
          >
            Select ports or modules to infer the physical link.
          </div>
        {/if}
        {#if addFromStandard && addToStandard && addFromStandard !== addToStandard}
          <div class="mt-2 text-[10px] text-amber-600">
            Asymmetric: {addFromStandard} ↔ {addToStandard}
          </div>
        {/if}
        {#if addDraftIssues.length > 0}
          <div class="mt-2 space-y-1.5">
            {#each addDraftIssues as issue}
              <div
                class="flex items-start gap-2 rounded-md border bg-muted/20 px-2 py-1.5 text-[10px] {issue.severity ===
                'error'
                  ? 'border-destructive/25 text-destructive'
                  : issue.severity === 'warning'
                    ? 'border-amber-500/25 text-amber-700 dark:text-amber-300'
                    : 'border-blue-500/25 text-blue-700 dark:text-blue-300'}"
              >
                {#if issue.severity === 'error'}
                  <WarningCircle weight="fill" class="mt-0.5 h-3 w-3 shrink-0" />
                {:else if issue.severity === 'warning'}
                  <Warning weight="fill" class="mt-0.5 h-3 w-3 shrink-0" />
                {:else}
                  <Info weight="fill" class="mt-0.5 h-3 w-3 shrink-0" />
                {/if}
                <div class="min-w-0">
                  <div class="font-mono text-[9px] opacity-70">{issue.code}</div>
                  <div class="text-foreground/80 dark:text-foreground/75">{issue.message}</div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <div class="space-y-2">
        <div class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Z end
        </div>
        <div class="grid gap-2 md:grid-cols-[minmax(8rem,0.9fr)_minmax(8rem,1fr)]">
          <div>
            <label class="text-[10px] text-muted-foreground mb-1 block" for="add-to-node">
              Node
            </label>
            <select
              id="add-to-node"
              class="w-full px-2 py-1.5 text-xs bg-background border border-input rounded-md outline-none focus:ring-1 focus:ring-ring"
              bind:value={addToNode}
            >
              <option value="">Node...</option>
              {#each nodeOptions as opt}
                <option value={opt.id}>{opt.label}</option>
              {/each}
            </select>
          </div>
          <div>
            <span class="text-[10px] text-muted-foreground mb-1 block">Port</span>
            <PortPicker
              nodeId={addToNode}
              value={addToPortId}
              disabled={!addToNode}
              onchange={(portId) => {
                addToPortId = portId
              }}
            />
          </div>
        </div>
        <div>
          <span class="text-[10px] text-muted-foreground mb-1 block">Plug / Module</span>
          <EndpointModulePicker
            class="w-full px-2 py-1.5 text-xs bg-background border border-input rounded-md outline-none focus:ring-1 focus:ring-ring"
            cage={addToCage}
            standard={addToStandard || undefined}
            disabled={!addToPortId}
            onchange={(v) => setAddStandard('to', v)}
          />
        </div>
      </div>
    </div>
  </Card.Content>
</Card.Root>

<!-- Connection table -->
{#if rows.length > 0}
  <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
    <div>
      <h2 class="text-sm font-semibold">Cables</h2>
      <div class="text-xs text-muted-foreground">Showing {visibleRows.length} of {rows.length}</div>
    </div>
    <div class="flex flex-1 flex-wrap items-center justify-end gap-2">
      <div class="relative w-full max-w-sm">
        <MagnifyingGlass
          class="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        />
        <input
          class="h-8 w-full rounded-md border border-input bg-background pl-8 pr-3 text-xs outline-none focus:ring-1 focus:ring-ring"
          placeholder="Search node, port, VLAN, standard..."
          bind:value={searchQuery}
        >
      </div>
      <Button
        variant={showOnlyIssues ? 'default' : 'outline'}
        size="sm"
        class="h-8 text-xs"
        onclick={() => {
          showOnlyIssues = !showOnlyIssues
        }}
      >
        Issues only
      </Button>
    </div>
  </div>
  <IssuesBanner issues={allRowIssues} onjump={jumpToRow} />
  <Card.Root class="py-0 mb-6 overflow-hidden">
    <Table.Root>
      <Table.Header>
        <Table.Row>
          <Table.Head>From</Table.Head>
          <Table.Head>To</Table.Head>
          <Table.Head class="w-32">Cable</Table.Head>
          <Table.Head class="w-20">Length</Table.Head>
          <Table.Head class="w-24">VLAN</Table.Head>
          <Table.Head>From IP</Table.Head>
          <Table.Head>To IP</Table.Head>
          <Table.Head>Label</Table.Head>
          <Table.Head class="w-10"></Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each visibleRows as row (row.id)}
          {@const fromCage = getPort(row.fromNode, row.fromPort)?.cage}
          {@const toCage = getPort(row.toNode, row.toPort)?.cage}
          {@const referenceStandard = row.link.from.plug?.module?.standard ?? row.link.to.plug?.module?.standard}
          {@const gradeOptions = cableGradesForStandard(referenceStandard)}
          {@const rowSeverity = row.issues.find((i) => i.severity === 'error')?.severity
            ?? row.issues.find((i) => i.severity === 'warning')?.severity}
          <Table.Row
            id={`connection-row-${row.id}`}
            class={`transition-colors ${
              rowSeverity === 'error'
                ? 'bg-destructive/[0.025]'
                : rowSeverity === 'warning'
                  ? 'bg-amber-500/[0.025]'
                  : ''
            } ${highlightedRowId === row.id ? 'bg-amber-100 dark:bg-amber-900/40' : ''}`}
          >
            <Table.Cell>
              <div class="font-mono text-xs space-y-1">
                <div class="font-medium">{row.fromNode}</div>
                <PortPicker
                  nodeId={row.fromNode}
                  value={row.fromPort}
                  onchange={(portId) => updateEndpointPort(row.link, 'from', portId)}
                />
                <ValidationCell
                  issues={[
                    ...issuesForTarget(row.issues, { kind: 'endpoint', side: 'source', field: 'plug.cage' }),
                    ...issuesForTarget(row.issues, { kind: 'endpoint', side: 'source', field: 'plug.module' }),
                    ...issuesForTarget(row.issues, { kind: 'port', side: 'source', field: 'poe' }),
                  ]}
                >
                  <EndpointModulePicker
                    class={cellInput}
                    cage={fromCage}
                    standard={row.link.from.plug?.module?.standard}
                    onchange={(v) => updateEndpointModuleStandard(row.link, 'from', v)}
                  />
                </ValidationCell>
              </div>
            </Table.Cell>
            <Table.Cell>
              <div class="font-mono text-xs space-y-1">
                <div class="font-medium">{row.toNode}</div>
                <PortPicker
                  nodeId={row.toNode}
                  value={row.toPort}
                  onchange={(portId) => updateEndpointPort(row.link, 'to', portId)}
                />
                <ValidationCell
                  issues={[
                    ...issuesForTarget(row.issues, { kind: 'endpoint', side: 'target', field: 'plug.cage' }),
                    ...issuesForTarget(row.issues, { kind: 'endpoint', side: 'target', field: 'plug.module' }),
                    ...issuesForTarget(row.issues, { kind: 'port', side: 'target', field: 'poe' }),
                  ]}
                >
                  <EndpointModulePicker
                    class={cellInput}
                    cage={toCage}
                    standard={row.link.to.plug?.module?.standard}
                    onchange={(v) => updateEndpointModuleStandard(row.link, 'to', v)}
                  />
                </ValidationCell>
              </div>
            </Table.Cell>
            <Table.Cell class="min-w-32">
              <ValidationCell
                issues={[
                  ...issuesForTarget(row.issues, { kind: 'cable', field: 'medium' }),
                  ...issuesForTarget(row.issues, { kind: 'cable', field: 'category' }),
                ]}
              >
                <select
                  class={cellInput}
                  disabled={gradeOptions.length === 0}
                  value={row.link.cable?.category ?? ''}
                  onchange={(e) => {
                    const v = (e.target as HTMLSelectElement).value
                    updateCableCategory(row.link, v ? (v as CableGrade) : undefined)
                  }}
                >
                  <option value="">—</option>
                  {#each gradeOptions as g}
                    <option value={g.value}>{g.label}</option>
                  {/each}
                </select>
              </ValidationCell>
            </Table.Cell>
            <Table.Cell>
              <ValidationCell
                issues={issuesForTarget(row.issues, { kind: 'cable', field: 'length_m' })}
              >
                <input
                  type="number"
                  min="0"
                  class={cellInput}
                  value={row.cableLength}
                  placeholder="—"
                  onblur={(e) => updateField(row.link, 'cableLength', (e.target as HTMLInputElement).value)}
                  onkeydown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                >
              </ValidationCell>
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
                onblur={(e) => updateEndpointIp(row.link, 'from', (e.target as HTMLInputElement).value)}
                onkeydown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
              >
            </Table.Cell>
            <Table.Cell>
              <input
                type="text"
                class={cellInput}
                value={row.toIp}
                placeholder="—"
                onblur={(e) => updateEndpointIp(row.link, 'to', (e.target as HTMLInputElement).value)}
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
        {#if visibleRows.length === 0}
          <Table.Row>
            <Table.Cell colspan={9} class="py-10 text-center text-sm text-muted-foreground">
              No connections match the current filters.
            </Table.Cell>
          </Table.Row>
        {/if}
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
