<script lang="ts">
  import { clsx } from 'clsx'
  import type { HTMLAttributes } from 'svelte/elements'
  import './ui.css'

  interface Props extends HTMLAttributes<HTMLDivElement> {
    padded?: boolean
    variant?: 'outlined' | 'ruled'
  }
  let { padded = true, variant = 'outlined', class: className, children, ...rest }: Props = $props()
</script>

<div
  {...rest}
  class={clsx('ui-panel', `ui-panel--${variant}`, padded && 'ui-panel--padded', className)}
>
  {@render children?.()}
</div>
