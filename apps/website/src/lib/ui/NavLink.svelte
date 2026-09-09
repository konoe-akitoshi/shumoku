<script lang="ts">
  import { clsx } from 'clsx'
  import type { HTMLAnchorAttributes } from 'svelte/elements'
  import './ui.css'
  interface Props extends HTMLAnchorAttributes {
    href: string
  }
  let { href, class: className, children, ...rest }: Props = $props()
</script>

<a {...rest} {href} class={clsx('ui-nav-link ui-marker', className)}
  ><span class="ui-marker-label">{@render children?.()}</span></a
>
