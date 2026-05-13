<script lang="ts">
  import { Dialog } from 'bits-ui'
  import { Check, X } from 'phosphor-svelte'
  import { Button } from '$lib/components/ui/button'

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
    <Dialog.Overlay class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
    <Dialog.Content
      class="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[min(360px,calc(100vw-2rem))] rounded-lg border bg-background shadow-2xl"
    >
      <div class="flex items-center justify-between border-b px-4 py-3">
        <Dialog.Title class="text-sm font-semibold">Subgraph color</Dialog.Title>
        <Dialog.Close class="rounded p-1 text-muted-foreground hover:bg-muted" aria-label="Close"
          ><X class="h-4 w-4" /></Dialog.Close
        >
      </div>

      <div class="space-y-3 px-4 py-4">
        <div>
          <div
            class="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
          >
            Theme palette
          </div>
          <div class="grid grid-cols-4 gap-2">
            {#each ACCENT_OPTIONS as opt (opt.token)}
              {@const selected = currentFill === opt.token}
              <button
                type="button"
                class="group relative flex h-14 flex-col items-center justify-center gap-1 rounded border bg-background transition-colors hover:border-blue-400"
                class:border-blue-500={selected}
                onclick={() => pick(opt.token)}
                title={opt.token}
              >
                <span
                  class="block h-6 w-6 rounded border border-black/10"
                  style="background-color: {opt.preview};"
                ></span>
                <span class="text-[9px] text-muted-foreground">{opt.label}</span>
                {#if selected}
                  <Check class="absolute right-1 top-1 h-3 w-3 text-blue-500" />
                {/if}
              </button>
            {/each}
          </div>
        </div>

        <div>
          <div
            class="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
          >
            Custom hex
          </div>
          <div class="flex items-center gap-2">
            <input
              type="text"
              bind:value={customHex}
              placeholder="#abcdef"
              class="flex-1 rounded border border-input bg-background px-2 py-1 font-mono text-xs outline-none focus:ring-1 focus:ring-ring"
              onkeydown={(e) => {
                if (e.key === 'Enter') applyCustom()
              }}
            >
            <Button size="sm" variant="outline" onclick={applyCustom}>Apply</Button>
          </div>
        </div>
      </div>

      <div class="flex items-center justify-between border-t px-4 py-2.5">
        <Button variant="ghost" size="sm" onclick={clear}>Reset to default</Button>
        <Dialog.Close>
          {#snippet child({ props })}
            <Button {...props} variant="ghost" size="sm">Cancel</Button>
          {/snippet}
        </Dialog.Close>
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
