<script lang="ts">
  import { Dialog } from 'bits-ui'
  import { X } from 'phosphor-svelte'

  // Tokens defined in the theme palette (libs/@shumoku/core/src/themes/*.ts).
  // The renderer resolves these per-theme, so we list both the token id
  // and a representative light-mode preview color for the swatch button.
  // Adding a new accent here requires adding it to themes/light.ts +
  // themes/dark.ts.
  const ACCENT_OPTIONS = [
    { token: 'accent-blue', label: 'Blue', preview: '#bfdbfe' },
    { token: 'accent-green', label: 'Green', preview: '#bbf7d0' },
    { token: 'accent-red', label: 'Red', preview: '#fecdd3' },
    { token: 'accent-amber', label: 'Amber', preview: '#fcd34d' },
    { token: 'accent-purple', label: 'Purple', preview: '#e9d5ff' },
    { token: 'surface-1', label: 'Neutral 1', preview: '#e2e8f0' },
    { token: 'surface-2', label: 'Neutral 2', preview: '#cbd5e1' },
    { token: 'surface-3', label: 'Neutral 3', preview: '#94a3b8' },
  ] as const

  let {
    open = $bindable(false),
    currentFill = '',
    onpick,
  }: {
    open?: boolean
    currentFill?: string
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

<Dialog.Root bind:open>
  <Dialog.Portal>
    <Dialog.Overlay class="fixed inset-0 z-50 bg-black/40" />
    <Dialog.Content
      class="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[260px] rounded-md border bg-background p-3 shadow-xl"
    >
      <div class="mb-2 flex items-center justify-between">
        <Dialog.Title class="text-[11px] font-medium text-muted-foreground">Color</Dialog.Title>
        <Dialog.Close class="text-muted-foreground/60 hover:text-foreground" aria-label="Close"
          ><X class="h-3 w-3" /></Dialog.Close
        >
      </div>

      <!-- Swatch grid — square tiles, no labels (token in tooltip). Selected
           tile gets an inset ring so the palette stays a flat continuous
           strip without chrome. -->
      <div class="mb-2 grid grid-cols-8 gap-1">
        {#each ACCENT_OPTIONS as opt (opt.token)}
          {@const selected = currentFill === opt.token}
          <button
            type="button"
            class="h-6 w-6 rounded-sm border border-black/10 outline-none transition-shadow hover:ring-2 hover:ring-blue-300"
            class:ring-2={selected}
            class:ring-foreground={selected}
            style="background-color: {opt.preview};"
            onclick={() => pick(opt.token)}
            title={opt.token}
            aria-label={opt.token}
          ></button>
        {/each}
      </div>

      <!-- Custom hex — single inline row, no header. Live preview swatch
           on the left mirrors the typed value once it's a valid hex. -->
      {@const validHex = /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(customHex.trim())}
      <div class="flex items-center gap-1.5">
        <span
          class="h-6 w-6 shrink-0 rounded-sm border border-black/10"
          style={validHex ? `background-color: ${customHex.trim()};` : 'background: repeating-linear-gradient(45deg,#f8fafc,#f8fafc 4px,#e2e8f0 4px,#e2e8f0 8px);'}
        ></span>
        <input
          type="text"
          bind:value={customHex}
          placeholder="#abcdef"
          class="flex-1 rounded-sm border border-input bg-background px-1.5 py-1 font-mono text-[11px] outline-none focus:ring-1 focus:ring-ring"
          onkeydown={(e) => {
            if (e.key === 'Enter') applyCustom()
          }}
        >
        <button
          type="button"
          class="rounded-sm px-2 py-1 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
          disabled={!validHex}
          onclick={applyCustom}
        >
          Set
        </button>
      </div>

      <!-- Reset link — tertiary action, no border, no button chrome. -->
      <button
        type="button"
        class="mt-2 text-[10px] text-muted-foreground hover:text-foreground"
        onclick={clear}
      >
        Clear color
      </button>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
