<script lang="ts">
  /**
   * Shared frame for the Node / Link mapping panels: the card + header with
   * Auto-map, optional Clear, and an optional search box. The list body and any
   * extra header controls (e.g. the link "single candidate fallback" toggle)
   * are passed as snippets, so the two mapping tabs share one outer frame.
   */
  import { CircleNotchIcon, LightningIcon, MagnifyingGlassIcon, TrashIcon } from 'phosphor-svelte'
  import type { Snippet } from 'svelte'
  import { Button } from '$lib/components/ui/button'

  let {
    title,
    onAutoMap,
    autoMapDisabled = false,
    autoMapBusy = false,
    onClear,
    clearDisabled = false,
    searchValue = $bindable(),
    searchPlaceholder = 'Search…',
    actions,
    children,
  }: {
    title: string
    onAutoMap: () => void
    autoMapDisabled?: boolean
    /** True while an auto-map request is in flight — shows a spinner and locks the button. */
    autoMapBusy?: boolean
    /** Omit to hide the Clear button (e.g. links have no clear-all yet). */
    onClear?: () => void
    clearDisabled?: boolean
    /** Bind a string to show the search box; leave unbound to hide it. */
    searchValue?: string
    searchPlaceholder?: string
    /** Extra header controls, rendered left of Auto-map. */
    actions?: Snippet
    /** The list body. */
    children: Snippet
  } = $props()

  const hasSearch = $derived(searchValue !== undefined)
</script>

<div class="card">
  <div class="card-header">
    <div class="flex items-center justify-between gap-4" class:mb-3={hasSearch}>
      <h2 class="font-medium text-theme-text-emphasis">{title}</h2>
      <div class="flex items-center gap-2">
        {@render actions?.()}
        <Button
          variant="outline"
          size="sm"
          onclick={onAutoMap}
          disabled={autoMapDisabled || autoMapBusy}
        >
          {#if autoMapBusy}
            <CircleNotchIcon size={14} class="mr-1 animate-spin" />
            Auto-mapping…
          {:else}
            <LightningIcon size={14} class="mr-1" />
            Auto-map
          {/if}
        </Button>
        {#if onClear}
          <Button variant="outline" size="sm" onclick={onClear} disabled={clearDisabled}>
            <TrashIcon size={14} class="mr-1" />
            Clear
          </Button>
        {/if}
      </div>
    </div>
    {#if hasSearch}
      <div class="relative">
        <MagnifyingGlassIcon
          size={16}
          class="absolute left-3 top-1/2 -translate-y-1/2 text-theme-text-muted"
        />
        <input
          type="text"
          class="input w-full"
          style="padding-left: 2.25rem;"
          placeholder={searchPlaceholder}
          bind:value={searchValue}
        >
      </div>
    {/if}
  </div>
  {@render children()}
</div>
