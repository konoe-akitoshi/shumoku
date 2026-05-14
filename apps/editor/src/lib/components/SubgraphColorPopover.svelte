<script lang="ts">
  import { Popover } from 'bits-ui'
  import { SUBGRAPH_PALETTE } from './subgraph-palette'

  let {
    open = $bindable(false),
    currentFill = '',
    anchor,
    onpick,
  }: {
    open?: boolean
    currentFill?: string
    /** Element the popover anchors to (the clicked swatch). */
    anchor?: HTMLElement | null
    onpick: (fill: string | undefined) => void
  } = $props()

  // Live edit value for the "Custom hex" input. Initialized from
  // currentFill when it looks like a hex value; otherwise blank.
  let customHex = $state('')
  $effect(() => {
    if (open && currentFill?.startsWith('#')) customHex = currentFill
    else if (open) customHex = ''
  })

  function pick(token: string) {
    onpick(token)
    open = false
  }

  function clear() {
    onpick(undefined)
    open = false
  }

  function applyCustom() {
    const v = customHex.trim()
    if (!/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(v)) return
    onpick(v)
    open = false
  }
</script>

<Popover.Root bind:open>
  <!-- Invisible trigger — the consumer (SubgraphProperties) supplies
       its own swatch button and opens the popover by toggling `open`.
       The customAnchor lets the popover position relative to that
       external swatch element. -->
  <Popover.Trigger class="sr-only" aria-hidden="true" tabindex={-1}
    >open color picker</Popover.Trigger
  >
  <Popover.Content
    class="z-50 w-[320px] rounded-md border bg-background p-3 shadow-xl"
    side="bottom"
    align="end"
    sideOffset={6}
    customAnchor={anchor ?? null}
  >
    <!-- Two-column rows: label on the left, controls on the right.
         Keeps the rows visually aligned and matches a standard
         "color: [palette]" form layout. -->
    {@const validHex = /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(customHex.trim())}
    <div class="grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-2">
      <span class="text-[10px] uppercase tracking-wider text-muted-foreground">Theme</span>
      <div class="flex flex-wrap gap-1">
        {#each SUBGRAPH_PALETTE as opt (opt.token)}
          {@const selected = currentFill === opt.token}
          <button
            type="button"
            class="h-6 w-6 rounded-sm border border-black/10 outline-none transition-shadow hover:ring-2 hover:ring-blue-300"
            class:ring-2={selected}
            class:ring-foreground={selected}
            style="background-color: {opt.preview};"
            onclick={() => pick(opt.token)}
            title={opt.label}
            aria-label={opt.label}
          ></button>
        {/each}
      </div>

      <span class="text-[10px] uppercase tracking-wider text-muted-foreground">Custom</span>
      <div class="flex items-center gap-1.5">
        <span
          class="h-6 w-6 shrink-0 rounded-sm border border-black/10"
          style={validHex ? `background-color: ${customHex.trim()};` : 'background: repeating-linear-gradient(45deg,#f8fafc,#f8fafc 4px,#e2e8f0 4px,#e2e8f0 8px);'}
        ></span>
        <input
          type="text"
          bind:value={customHex}
          placeholder="#abcdef"
          class="min-w-0 flex-1 rounded-sm border border-input bg-background px-1.5 py-1 font-mono text-[11px] outline-none focus:ring-1 focus:ring-ring"
          onkeydown={(e) => {
            if (e.key === 'Enter') applyCustom()
          }}
        >
        <button
          type="button"
          class="shrink-0 rounded-sm px-2 py-1 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
          disabled={!validHex}
          onclick={applyCustom}
        >
          Set
        </button>
      </div>
    </div>

    <!-- Reset link — tertiary action below the rows. -->
    <button
      type="button"
      class="mt-2 text-[10px] text-muted-foreground hover:text-foreground"
      onclick={clear}
    >
      Clear color
    </button>
  </Popover.Content>
</Popover.Root>
