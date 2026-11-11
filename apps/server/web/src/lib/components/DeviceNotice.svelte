<script lang="ts">
  import { Button } from '$lib/components/ui/button'

  /** One dismissible result notice (read summary, edit result), with an optional undo. */
  interface Props {
    text: string
    busy?: boolean
    onUndo?: () => void
    onDismiss: () => void
  }

  let { text, busy = false, onUndo, onDismiss }: Props = $props()
</script>

<div
  class="flex flex-wrap items-center gap-2 rounded border border-border bg-muted/40 px-3 py-2 text-sm"
  role="status"
>
  <p class="min-w-0 flex-1">{text}</p>
  {#if onUndo}
    <Button variant="outline" size="sm" disabled={busy} onclick={onUndo}>元に戻す</Button>
  {/if}
  <Button variant="ghost" size="sm" aria-label="閉じる" onclick={onDismiss}>×</Button>
</div>
