<script lang="ts">
  import { DropdownMenu, Tooltip } from 'bits-ui'
  import { DownloadSimple, Export, Printer } from 'phosphor-svelte'

  let {
    onexportjson,
    onexportsvg,
  }: {
    onexportjson?: () => void
    onexportsvg?: () => void
  } = $props()

  const itemClass =
    'flex items-center gap-2 px-3 py-2 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 cursor-pointer transition-colors'
  const iconClass = 'w-4 h-4 text-neutral-400'

  /**
   * Print the current page via the browser's native print flow.
   *
   * Waits for web fonts and any data-URL images on the print surface
   * to be ready before opening the print dialog — otherwise Chrome
   * sometimes flashes the dialog mid-decode and prints a blank or
   * fallback-font frame.
   */
  async function printPage(): Promise<void> {
    try {
      await document.fonts?.ready
    } catch {
      // ignore — old browsers
    }
    const imgs = document.querySelectorAll<HTMLImageElement>(
      '[data-print-canvas] img, [data-print-only] img',
    )
    await Promise.all(
      [...imgs].map((img) => (img.complete ? undefined : img.decode().catch(() => undefined))),
    )
    window.print()
  }
</script>

<svelte:window
  onkeydown={(e) => {
    // Ctrl/Cmd+P → ensure fonts/images settle before the dialog
    if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
      e.preventDefault()
      void printPage()
    }
  }}
/>

<DropdownMenu.Root>
  <DropdownMenu.Trigger>
    <Tooltip.Root>
      <Tooltip.Trigger>
        <button
          type="button"
          class="flex items-center gap-1.5 px-3 py-2 bg-white/90 dark:bg-neutral-800/90 backdrop-blur-sm border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-lg text-sm font-medium text-neutral-700 dark:text-neutral-200 hover:bg-white dark:hover:bg-neutral-700 transition-colors"
        >
          <Export class="w-4 h-4" />
          Export
        </button>
      </Tooltip.Trigger>
      <Tooltip.Content class="bg-neutral-800 text-white text-xs px-2 py-1 rounded shadow-lg">
        Export diagram
      </Tooltip.Content>
    </Tooltip.Root>
  </DropdownMenu.Trigger>
  <DropdownMenu.Content
    class="min-w-[160px] bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-lg py-1 text-sm z-50"
    sideOffset={4}
    align="end"
  >
    <DropdownMenu.Item class={itemClass} onSelect={() => onexportjson?.()}>
      <DownloadSimple class={iconClass} />
      JSON
    </DropdownMenu.Item>
    <DropdownMenu.Item class={itemClass} onSelect={() => onexportsvg?.()}>
      <DownloadSimple class={iconClass} />
      SVG
    </DropdownMenu.Item>
    <DropdownMenu.Item class={itemClass} onSelect={() => void printPage()}>
      <Printer class={iconClass} />
      Print
    </DropdownMenu.Item>
  </DropdownMenu.Content>
</DropdownMenu.Root>
