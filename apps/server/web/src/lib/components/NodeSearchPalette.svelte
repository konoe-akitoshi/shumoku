<script lang="ts">
  import * as Command from '$lib/components/ui/command'

  interface NodeEntry {
    id: string
    label: string
    spec?: {
      type?: string
      vendor?: string
      model?: string
    }
  }

  interface Props {
    open: boolean
    getSvgElement: () => SVGSVGElement | null
    onSelect?: (nodeId: string) => void
  }

  let { open = $bindable(false), getSvgElement, onSelect }: Props = $props()

  // Collect nodes from SVG each time palette opens
  let allNodes = $derived.by(() => {
    if (!open) return []
    const svgElement = getSvgElement()
    if (!svgElement) return []
    const nodes: NodeEntry[] = []
    const nodeEls = svgElement.querySelectorAll('g.node')
    nodeEls.forEach((el) => {
      const id = el.getAttribute('data-id') || ''
      const labelEl = el.querySelector('text.node-label, text')
      const label = labelEl?.textContent?.trim() || id
      const type = el.getAttribute('data-device-type') || undefined
      const vendor = el.getAttribute('data-device-vendor') || undefined
      const model = el.getAttribute('data-device-model') || undefined
      nodes.push({ id, label, spec: { type, vendor, model } })
    })
    return nodes
  })

  // Custom filter: match label/id/type, prioritize label-starts-with
  function filterNodes(value: string, search: string, keywords?: string[]) {
    const q = search.toLowerCase()
    const v = value.toLowerCase()
    // keywords contain id and type joined
    const kw = (keywords ?? []).join(' ').toLowerCase()

    const labelStarts = v.startsWith(q)
    const labelContains = v.includes(q)
    const kwContains = kw.includes(q)

    if (labelStarts) return 1
    if (labelContains) return 0.5
    if (kwContains) return 0.25
    return 0
  }

  function handleSelect(nodeId: string) {
    open = false
    onSelect?.(nodeId)
  }
</script>

<Command.Dialog
  bind:open
  title="Search Nodes"
  description="Search for a node to focus on"
  filter={filterNodes}
>
  <Command.Input placeholder="Search nodes..." />
  <Command.List>
    <Command.Empty>No nodes found.</Command.Empty>
    <Command.Group heading="Nodes">
      {#each allNodes as node (node.id)}
        <Command.Item
          value={node.label}
          keywords={[node.id, node.spec?.type ?? '', node.spec?.vendor ?? '', node.spec?.model ?? '']}
          onSelect={() => handleSelect(node.id)}
        >
          <span>{node.label}</span>
          {#if node.spec?.vendor || node.spec?.model || node.spec?.type}
            <Command.Shortcut>
              {[node.spec?.vendor, node.spec?.model, node.spec?.type].filter(Boolean).join(' / ')}
            </Command.Shortcut>
          {/if}
        </Command.Item>
      {/each}
    </Command.Group>
  </Command.List>
</Command.Dialog>
