<script lang="ts">
  import { DropdownMenu } from 'bits-ui'
  import { DownloadSimpleIcon } from 'phosphor-svelte'
  import { api } from '$lib/api'

  let {
    topologyId,
    sheetId,
  }: {
    topologyId: string
    sheetId?: string | null
  } = $props()

  type ExportFormat = 'svg' | 'png' | 'html'

  let downloading = $state<ExportFormat | null>(null)
  let error = $state('')

  const itemClass =
    'flex cursor-pointer items-center gap-2 rounded-sm px-2.5 py-2 text-sm outline-none data-[highlighted]:bg-accent'

  async function download(format: ExportFormat): Promise<void> {
    if (downloading) return
    downloading = format
    error = ''
    try {
      const result = await api.topologies.exportFile(topologyId, {
        format,
        sheet: format === 'html' ? undefined : (sheetId ?? 'root'),
        scale: format === 'png' ? 2 : undefined,
      })
      const url = URL.createObjectURL(result.blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = result.filename
      document.body.append(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'Export failed'
    } finally {
      downloading = null
    }
  }
</script>

{#if error}
  <span class="max-w-56 text-right text-xs text-danger" role="alert">{error}</span>
{/if}

<DropdownMenu.Root>
  <DropdownMenu.Trigger
    disabled={downloading !== null}
    class="inline-flex items-center gap-1.5 rounded-lg border border-theme-border bg-theme-bg-elevated/90 px-3 py-1.5 text-sm font-medium text-theme-text backdrop-blur transition-colors hover:text-primary disabled:cursor-wait disabled:opacity-60"
  >
    <DownloadSimpleIcon size={16} />
    {downloading ? 'Exporting…' : 'Export'}
  </DropdownMenu.Trigger>
  <DropdownMenu.Content
    sideOffset={6}
    align="end"
    class="z-50 min-w-[13rem] rounded-md border border-border bg-popover p-1 shadow-lg"
  >
    <DropdownMenu.Item class={itemClass} onSelect={() => void download('svg')}>
      <DownloadSimpleIcon size={16} />
      <span>
        <span class="block">SVG</span>
        <span class="block text-[10px] text-muted-foreground">
          {sheetId ? 'Current sheet' : 'Root sheet'}
        </span>
      </span>
    </DropdownMenu.Item>
    <DropdownMenu.Item class={itemClass} onSelect={() => void download('png')}>
      <DownloadSimpleIcon size={16} />
      <span>
        <span class="block">PNG</span>
        <span class="block text-[10px] text-muted-foreground">
          {sheetId ? 'Current sheet · 2×' : 'Root sheet · 2×'}
        </span>
      </span>
    </DropdownMenu.Item>
    <DropdownMenu.Item class={itemClass} onSelect={() => void download('html')}>
      <DownloadSimpleIcon size={16} />
      <span>
        <span class="block">Interactive HTML</span>
        <span class="block text-[10px] text-muted-foreground">All sheets</span>
      </span>
    </DropdownMenu.Item>
  </DropdownMenu.Content>
</DropdownMenu.Root>
