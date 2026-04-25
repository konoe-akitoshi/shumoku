<script lang="ts">
  import { type NetworkGraph, specDeviceType } from '@shumoku/core'
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
    /**
     * Returns the current graph. Reads from the domain model so the
     * palette doesn't have to scrape the rendered SVG (which would
     * re-leak the renderer's class names + DOM structure into a
     * UI component that has no business knowing them).
     */
    getGraph: () => NetworkGraph | null | undefined
    onSelect?: (nodeId: string) => void
  }

  let { open = $bindable(false), getGraph, onSelect }: Props = $props()

  // Collect node entries from the graph each time the palette opens.
  let allNodes = $derived.by(() => {
    if (!open) return []
    const graph = getGraph()
    if (!graph) return []
    return graph.nodes.map<NodeEntry>((node) => {
      const label = Array.isArray(node.label)
        ? node.label.join(' ').trim() || node.id
        : node.label?.trim() || node.id
      const type = specDeviceType(node.spec)
      const hardware = node.spec?.kind === 'hardware' ? node.spec : undefined
      return {
        id: node.id,
        label,
        spec: {
          type,
          vendor: hardware?.vendor,
          model: hardware?.model,
        },
      }
    })
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
