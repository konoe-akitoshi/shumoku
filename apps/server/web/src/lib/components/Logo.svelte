<script lang="ts">
interface Props {
  size?: number
  class?: string
}

let { size = 24, class: className = '' }: Props = $props()
</script>

<img
  src="/logo-symbol.svg"
  alt="Shumoku"
  width={size}
  height={size}
  class={className}
/>
