<script lang="ts">
  import type { ComponentProps } from 'svelte'
  import Button from './Button.svelte'

  type Props = Omit<ComponentProps<typeof Button>, 'size' | 'aria-label'> & { label: string }
  let { label, title = label, variant = 'ghost', ...rest }: Props = $props()
</script>

<Button {...rest} {title} {variant} size="icon" aria-label={label} />
