<script lang="ts">
  import type { HTMLButtonAttributes } from 'svelte/elements'
  import { type ControlSize, type ControlVariant, controlClass } from './control'
  import './ui.css'

  interface Props extends HTMLButtonAttributes {
    variant?: ControlVariant
    size?: ControlSize
  }
  let {
    variant = 'secondary',
    size = 'default',
    type = 'button',
    class: className,
    children,
    ...rest
  }: Props = $props()
</script>

<button {...rest} {type} class={controlClass(variant, size, className)}>
  {@render children?.()}
</button>
