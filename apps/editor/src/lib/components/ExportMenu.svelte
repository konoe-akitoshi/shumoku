<script lang="ts">
  import { DropdownMenu, Tooltip } from 'bits-ui'
  import { DownloadSimple, Export, UploadSimple } from 'phosphor-svelte'

  let {
    onsave,
    onload,
  }: {
    onsave?: () => void
    onload?: () => void
  } = $props()
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
          File
        </button>
      </Tooltip.Trigger>
      <Tooltip.Content class="bg-neutral-800 text-white text-xs px-2 py-1 rounded shadow-lg">
        Save / Load / Export
      </Tooltip.Content>
    </Tooltip.Root>
  </DropdownMenu.Trigger>
  <DropdownMenu.Content
    class="min-w-[180px] bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-lg py-1 text-sm z-50"
    sideOffset={4}
    align="end"
  >
    <DropdownMenu.Item
      class="flex items-center gap-2 px-3 py-2 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 cursor-pointer transition-colors"
      onSelect={() => onsave?.()}
    >
      <DownloadSimple class="w-4 h-4 text-neutral-400" />
      Save as JSON
    </DropdownMenu.Item>
    <DropdownMenu.Item
      class="flex items-center gap-2 px-3 py-2 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 cursor-pointer transition-colors"
      onSelect={() => onload?.()}
    >
      <UploadSimple class="w-4 h-4 text-neutral-400" />
      Load from JSON
    </DropdownMenu.Item>
  </DropdownMenu.Content>
</DropdownMenu.Root>
