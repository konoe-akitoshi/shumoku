<script lang="ts">
  import { DropdownMenu, Tooltip } from 'bits-ui'
  import { DownloadSimple, Export } from 'phosphor-svelte'

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
</script>

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
  </DropdownMenu.Content>
</DropdownMenu.Root>
