<script lang="ts">
  import * as Dialog from '$lib/components/ui/dialog'
  import type { NodeSelectEvent } from './InteractiveSvgDiagram.svelte'

  interface Props {
    open: boolean
    nodeData: NodeSelectEvent | null
    onLocate: (id: string) => void
    onConfigure?: () => void
  }
  let { open = $bindable(false), nodeData, onLocate, onConfigure }: Props = $props()
  const metadata = $derived(Object.entries(nodeData?.node.metadata ?? {}).filter(([key]) => key !== 'sourceDiagnostics'))
  const peers = $derived(nodeData?.connectedLinks.map((link) =>
    link.from.id === nodeData?.node.id ? link.to : link.from) ?? [])

  function records(value: unknown): Record<string, unknown>[] | null {
    if (!Array.isArray(value) || !value.length) return null
    if (!value.every((row) => row !== null && typeof row === 'object' && !Array.isArray(row))) return null
    return value as Record<string, unknown>[]
  }
  function columns(rows: Record<string, unknown>[]): string[] {
    return [...new Set(rows.flatMap((row) => Object.keys(row)))]
  }
  function display(value: unknown): string {
    if (value === undefined || value === null || value === '') return '—'
    if (Array.isArray(value)) return value.length ? value.map(display).join(', ') : 'None'
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="sm:max-w-3xl">
    <Dialog.Header>
      <Dialog.Title class="break-words pr-6">{nodeData?.node.label ?? 'Node details'}</Dialog.Title>
      <Dialog.Description>Source observations and related nodes</Dialog.Description>
    </Dialog.Header>
    {#if nodeData}
      <div class="space-y-5 min-w-0">
        {#if nodeData.node.provenance?.observedAt}
          <p class="text-sm text-muted-foreground">Observed {new Date(nodeData.node.provenance.observedAt).toLocaleString()}</p>
        {/if}
        {#each metadata as [label, value] (label)}
          {@const rows = records(value)}
          {#if rows}
            {@const keys = columns(rows)}
            <section class="space-y-2">
              <h3 class="text-sm font-semibold">{label} ({rows.length})</h3>
              <div class="overflow-x-auto rounded border border-border">
                <table class="w-full text-sm text-left">
                  <thead class="bg-muted"><tr>{#each keys as key}<th class="px-3 py-2 font-medium">{key}</th>{/each}</tr></thead>
                  <tbody>{#each rows as row}<tr class="border-t border-border">{#each keys as key}<td class="px-3 py-2 align-top break-words">{display(row[key])}</td>{/each}</tr>{/each}</tbody>
                </table>
              </div>
            </section>
          {:else}
            <div class="grid gap-1 sm:grid-cols-[9rem_1fr] text-sm">
              <div class="font-medium">{label}</div><div class="break-words whitespace-pre-wrap text-muted-foreground">{display(value)}</div>
            </div>
          {/if}
        {/each}
        {#if metadata.length === 0}<p class="text-sm text-muted-foreground">No additional source details.</p>{/if}
        <section class="space-y-2 border-t border-border pt-4">
          <h3 class="text-sm font-semibold">Related nodes</h3>
          {#each peers as peer, i (`${peer.id}:${i}`)}
            <button class="block text-left text-sm text-primary underline-offset-4 hover:underline focus-visible:outline-2" onclick={() => { open = false; onLocate(peer.id) }}>{peer.label}</button>
          {:else}<p class="text-sm text-muted-foreground">No configured links.</p>{/each}
        </section>
        {#if onConfigure}<button class="btn btn-secondary" onclick={() => { open = false; onConfigure?.() }}>Monitoring settings</button>{/if}
      </div>
    {/if}
  </Dialog.Content>
</Dialog.Root>
