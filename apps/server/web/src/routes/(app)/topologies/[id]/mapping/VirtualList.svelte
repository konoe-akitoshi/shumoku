<script lang="ts" generics="T">
  /**
   * Generic virtualized list: renders only the ~visible rows of `items`.
   * Shared by the Node and Link mapping lists so large topologies (1000+) stay
   * cheap to render. The `row` snippet draws one item; its params are typed via
   * the `Snippet<[T, number]>` prop, so no in-markup annotation is needed
   * (which biome's Svelte parser rejects). Rows are measured dynamically, so
   * variable-height rows (links) lay out without clipping.
   */
  import { createVirtualizer } from '@tanstack/svelte-virtual'
  import type { Snippet } from 'svelte'
  import { get } from 'svelte/store'

  let {
    items,
    estimateSize = 64,
    overscan = 8,
    maxHeightClass = 'max-h-96',
    row,
  }: {
    items: T[]
    estimateSize?: number
    overscan?: number
    maxHeightClass?: string
    row: Snippet<[T, number]>
  } = $props()

  let scrollEl = $state<HTMLDivElement | null>(null)
  const virtualizer = createVirtualizer<HTMLDivElement, HTMLElement>({
    count: 0,
    getScrollElement: () => scrollEl,
    estimateSize: () => estimateSize,
  })

  // Keep options synced. get() = untracked read → no effect loop.
  $effect(() => {
    const count = items.length
    void scrollEl
    get(virtualizer).setOptions({
      count,
      overscan,
      getScrollElement: () => scrollEl,
      estimateSize: () => estimateSize,
    })
  })

  // Let the virtualizer measure each rendered row (reads data-index).
  function measure(node: HTMLElement) {
    get(virtualizer).measureElement(node)
  }
</script>

<div bind:this={scrollEl} class="{maxHeightClass} overflow-y-auto">
  <div style="height: {$virtualizer.getTotalSize()}px; position: relative;">
    {#each $virtualizer.getVirtualItems() as vrow (vrow.key)}
      {@const item = items[vrow.index]}
      {#if item !== undefined}
        <div
          data-index={vrow.index}
          use:measure
          class="absolute left-0 top-0 w-full"
          style="transform: translateY({vrow.start}px);"
        >
          {@render row(item, vrow.index)}
        </div>
      {/if}
    {/each}
  </div>
</div>
