<script lang="ts">
  import '../app.css'
  import { metricColorsCss } from '$lib/weathermap'

  // The live layers' colours, per theme, as CSS variables (lib/weathermap/colors.ts).
  const metricColors = `<style id="shumoku-metric-colors">${metricColorsCss()}</style>`
</script>

<svelte:head>
  {@html metricColors}
</svelte:head>

<slot />
