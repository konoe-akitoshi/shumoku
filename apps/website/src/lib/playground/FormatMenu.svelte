<script lang="ts">
  import Button from '$lib/ui/Button.svelte'
  import Disclosure from '$lib/ui/Disclosure.svelte'
  import type { Format } from './export'

  let {
    label,
    disabled,
    onselect,
  }: { label: string; disabled: boolean; onselect: (format: Format) => void } = $props()
  const formats = [
    { format: 'svg', label: 'Vector' },
    { format: 'html', label: 'Interactive' },
    { format: 'png', label: 'Image' },
  ] as const
</script>
<Disclosure {label} {disabled} variant="ghost" size="compact">
  {#each formats as item}
    <Button variant="ghost" size="compact" onclick={() => onselect(item.format)}>
      <span>.{item.format}</span>{item.label}
    </Button>
  {/each}
</Disclosure>
