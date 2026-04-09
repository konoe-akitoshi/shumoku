<script lang="ts">
  let {
    fromX,
    fromY,
    toX,
    toY,
  }: {
    fromX: number
    fromY: number
    toX: number
    toY: number
  } = $props()
</script>

<line
  x1={fromX}
  y1={fromY}
  x2={toX}
  y2={toY}
  stroke="#3b82f6"
  stroke-width="2"
  stroke-dasharray="6 3"
  pointer-events="none"
/>
