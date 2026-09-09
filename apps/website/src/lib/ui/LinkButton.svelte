<script lang="ts">
  import type { HTMLAnchorAttributes } from 'svelte/elements'
  import { type ControlSize, type ControlVariant, controlClass } from './control'
  import './ui.css'

  interface Props extends HTMLAnchorAttributes {
    href: string
    variant?: ControlVariant
    size?: ControlSize
  }
  let {
    variant = 'secondary',
    size = 'default',
    href,
    class: className,
    children,
    ...rest
  }: Props = $props()
</script>

<a {...rest} {href} class={controlClass(variant, size, className)}>{@render children?.()}</a>
