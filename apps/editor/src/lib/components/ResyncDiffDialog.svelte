<script lang="ts">
  import { Dialog } from 'bits-ui'
  import { ArrowClockwise, ArrowRight, X } from 'phosphor-svelte'
  import { Button } from '$lib/components/ui/button'
  import type { ResyncPreview } from '$lib/state/resync-diff'

  let {
    open = $bindable(false),
    productLabel,
    preview,
    onConfirm,
  }: {
    open?: boolean
    productLabel: string
    preview: ResyncPreview | null
    onConfirm: () => void
  } = $props()

  const totalChanges = $derived(
    preview ? preview.added.length + preview.removed.length + preview.changed.length : 0,
  )
  const hasNoChanges = $derived(
    preview !== null && totalChanges === 0 && !preview.propertiesChanged,
  )

  function apply() {
    onConfirm()
    open = false
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Portal>
    <Dialog.Overlay class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
    <Dialog.Content
      class="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[min(640px,calc(100vw-2rem))] max-h-[min(80vh,40rem)] flex flex-col rounded-lg border bg-background shadow-2xl"
    >
      <div class="flex items-start justify-between px-5 py-4 border-b">
        <div>
          <Dialog.Title class="text-sm font-semibold">Resync from catalog</Dialog.Title>
          <Dialog.Description class="mt-0.5 text-xs text-muted-foreground truncate"
            >{productLabel}</Dialog.Description
          >
        </div>
        <Dialog.Close class="p-1 rounded hover:bg-muted text-muted-foreground" aria-label="Close"
          ><X class="w-4 h-4" /></Dialog.Close
        >
      </div>

      <div class="flex-1 overflow-y-auto px-5 py-4 text-xs space-y-4">
        {#if !preview}
          <p class="text-muted-foreground">
            Preview unavailable — no catalog template found for this product.
          </p>
        {:else if hasNoChanges}
          <p class="text-muted-foreground">
            Already in sync. The catalog template matches the current product snapshot.
          </p>
        {:else}
          <div class="rounded-md border bg-muted/30 px-3 py-2 text-[11px]">
            <span class="font-mono">{preview.affectedNodeCount}</span>
            bound node{preview.affectedNodeCount === 1 ? '' : 's'}
            will be updated. Stable port ids are preserved so existing links keep resolving.
          </div>

          {#if preview.propertiesChanged}
            <div>
              <div
                class="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
              >
                Properties
              </div>
              <p class="text-muted-foreground">
                PoE / switching / wireless / physical / management properties will be refreshed from
                the catalog.
              </p>
            </div>
          {/if}

          {#if preview.added.length > 0}
            <div>
              <div
                class="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400"
              >
                Added ({preview.added.length})
              </div>
              <ul class="space-y-0.5">
                {#each preview.added as p (p.id)}
                  <li class="flex items-center gap-2 px-2 py-1 rounded bg-emerald-500/5">
                    <span class="font-mono font-semibold">{p.label || 'unnamed'}</span>
                    {#if p.faceplateLabel && p.faceplateLabel !== p.label}
                      <span class="text-[10px] text-muted-foreground"
                        >panel {p.faceplateLabel}</span
                      >
                    {/if}
                    <span class="text-muted-foreground">
                      {[p.speed, p.connectors?.join('/'), p.poe ? 'PoE' : '']
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </li>
                {/each}
              </ul>
            </div>
          {/if}

          {#if preview.removed.length > 0}
            <div>
              <div
                class="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-red-600 dark:text-red-400"
              >
                Removed ({preview.removed.length})
              </div>
              <p class="mb-1 text-[10px] text-muted-foreground">
                These ports stay on each bound node so existing links don't go orphan, but they lose
                their catalog source.
              </p>
              <ul class="space-y-0.5">
                {#each preview.removed as p (p.id)}
                  <li class="flex items-center gap-2 px-2 py-1 rounded bg-red-500/5">
                    <span class="font-mono font-semibold line-through opacity-70"
                      >{p.label || 'unnamed'}</span
                    >
                    {#if p.faceplateLabel && p.faceplateLabel !== p.label}
                      <span class="text-[10px] text-muted-foreground"
                        >panel {p.faceplateLabel}</span
                      >
                    {/if}
                    <span class="text-muted-foreground">
                      {[p.speed, p.connectors?.join('/'), p.poe ? 'PoE' : '']
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </li>
                {/each}
              </ul>
            </div>
          {/if}

          {#if preview.changed.length > 0}
            <div>
              <div
                class="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-amber-600 dark:text-amber-400"
              >
                Changed ({preview.changed.length})
              </div>
              <ul class="space-y-1">
                {#each preview.changed as ch (ch.before.id)}
                  <li class="rounded bg-amber-500/5 px-2 py-1.5">
                    <div class="flex items-center gap-1.5 font-mono font-semibold">
                      {ch.identity}
                    </div>
                    <ul class="mt-0.5 space-y-0.5 pl-3">
                      {#each ch.diffs as d}
                        <li class="flex items-center gap-1.5 text-[10px]">
                          <span class="text-muted-foreground w-16">{d.field}</span>
                          <span class="font-mono line-through opacity-70">{d.before || '—'}</span>
                          <ArrowRight class="w-3 h-3 text-muted-foreground" />
                          <span class="font-mono">{d.after || '—'}</span>
                        </li>
                      {/each}
                    </ul>
                  </li>
                {/each}
              </ul>
            </div>
          {/if}
        {/if}
      </div>

      <div class="flex items-center justify-end gap-2 border-t px-5 py-3">
        <Dialog.Close>
          {#snippet child({ props })}
            <Button {...props} variant="ghost" size="sm">Cancel</Button>
          {/snippet}
        </Dialog.Close>
        <Button variant="default" size="sm" onclick={apply} disabled={!preview || hasNoChanges}>
          <ArrowClockwise class="mr-1 h-3.5 w-3.5" />
          Apply resync
        </Button>
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
