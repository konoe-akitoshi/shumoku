<script lang="ts">
import { onMount, onDestroy, tick } from 'svelte'
import { metricsStore, metricsData } from '$lib/stores'

// Props
export let topologyId: string
export let enableMetrics = true

let svgContent = ''
let container: HTMLDivElement
let svgElement: SVGSVGElement | null = null
let styleElement: HTMLStyleElement | null = null
let interactiveInstance: {
  destroy: () => void
  resetView: () => void
  getScale: () => number
} | null = null
let loading = true
let error = ''
let scale = 1

// Utilization color scale
const utilizationColors = [
  { max: 0, color: '#6b7280' },
  { max: 1, color: '#22c55e' },
  { max: 25, color: '#84cc16' },
  { max: 50, color: '#eab308' },
  { max: 75, color: '#f97316' },
  { max: 90, color: '#ef4444' },
  { max: 100, color: '#dc2626' },
]

function getUtilizationColor(utilization: number): string {
  for (const t of utilizationColors) {
    if (utilization <= t.max) return t.color
  }
  return '#dc2626'
}

// Inject CSS into document head
function injectCSS(css: string) {
  if (styleElement) {
    styleElement.remove()
  }
  styleElement = document.createElement('style')
  styleElement.setAttribute('data-shumoku', 'true')
  styleElement.textContent = css
  document.head.appendChild(styleElement)
}

// Load interactive runtime script
async function loadRuntime(): Promise<void> {
  if ((window as any).ShumokuInteractive) return

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = '/api/runtime.js'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load runtime'))
    document.head.appendChild(script)
  })
}

// Fetch rendered content from API
async function loadContent() {
  loading = true
  error = ''
  try {
    // Load runtime first
    await loadRuntime()

    const res = await fetch(`/api/topologies/${topologyId}/render`)
    if (!res.ok) {
      throw new Error(`Failed to load topology: ${res.status}`)
    }
    const data = await res.json()
    svgContent = data.svg

    // Inject CSS
    if (data.css) {
      injectCSS(data.css)
    }

    // Set loading to false BEFORE tick so the SVG gets rendered
    loading = false

    // Wait for DOM update (SVG is now rendered)
    await tick()

    svgElement = container?.querySelector('svg') || null
    if (svgElement && (window as any).ShumokuInteractive) {
      if (interactiveInstance) {
        interactiveInstance.destroy()
      }
      interactiveInstance = (window as any).ShumokuInteractive.initInteractive({
        target: svgElement,
        panZoom: { enabled: true },
        tooltip: { enabled: true },
      })
      scale = interactiveInstance?.getScale() ?? 1
    }
  } catch (e) {
    error = e instanceof Error ? e.message : 'Unknown error'
    loading = false
  }
}

// Reset view
function resetView() {
  if (interactiveInstance) {
    interactiveInstance.resetView()
    scale = 1
  }
}

// Update scale display periodically
function updateScaleDisplay() {
  if (interactiveInstance) {
    scale = interactiveInstance.getScale()
  }
}

// Apply metrics to SVG elements
function applyMetrics(metrics: typeof $metricsData) {
  if (!svgElement || !metrics) return

  // Update link colors based on utilization
  if (metrics.links) {
    for (const [linkId, linkMetrics] of Object.entries(metrics.links)) {
      const linkGroup = svgElement.querySelector(`g.link-group[data-link-id="${linkId}"]`)
      if (!linkGroup) continue

      const paths = linkGroup.querySelectorAll('path.link')
      paths.forEach((path) => {
        const pathEl = path as SVGPathElement
        if (linkMetrics.status === 'down') {
          pathEl.setAttribute('stroke', '#ef4444')
          pathEl.style.strokeDasharray = '8 4'
          pathEl.style.animation = ''
        } else if (linkMetrics.utilization !== undefined) {
          const color = getUtilizationColor(linkMetrics.utilization)
          pathEl.setAttribute('stroke', color)

          if (linkMetrics.utilization > 0) {
            pathEl.style.strokeDasharray = '12 12'
            const duration = Math.max(0.3, 2 - (linkMetrics.utilization / 100) * 1.7)
            pathEl.style.animation = `shumoku-edge-flow ${duration.toFixed(2)}s linear infinite`
          } else {
            pathEl.style.strokeDasharray = ''
            pathEl.style.animation = ''
          }
        }
      })
    }
  }

  // Update node status indicators
  if (metrics.nodes) {
    for (const [nodeId, nodeMetrics] of Object.entries(metrics.nodes)) {
      const nodeGroup = svgElement.querySelector(`g.node[data-id="${nodeId}"]`)
      if (!nodeGroup) continue

      const rect = nodeGroup.querySelector('.node-bg rect') as SVGRectElement
      if (rect) {
        if (nodeMetrics.status === 'down') {
          rect.setAttribute('stroke', '#ef4444')
          rect.setAttribute('stroke-width', '2')
        } else if (nodeMetrics.status === 'up') {
          rect.setAttribute('stroke', '#22c55e')
          rect.setAttribute('stroke-width', '2')
        }
      }
    }
  }
}

// Track previous enableMetrics state to detect changes
let prevEnableMetrics = enableMetrics

// Watch for metrics toggle
$: if (topologyId && prevEnableMetrics !== enableMetrics) {
  prevEnableMetrics = enableMetrics
  if (enableMetrics) {
    metricsStore.connect()
    metricsStore.subscribeToTopology(topologyId)
  } else {
    metricsStore.disconnect()
    // Reload SVG to reset all styles to original
    loadContent()
  }
}

// Apply metrics when data changes
$: if (enableMetrics && $metricsData && svgElement) {
  applyMetrics($metricsData)
}

let scaleInterval: ReturnType<typeof setInterval> | null = null

onMount(async () => {
  await loadContent()

  // Initial metrics connection
  if (enableMetrics && topologyId) {
    metricsStore.connect()
    metricsStore.subscribeToTopology(topologyId)
  }

  // Update scale display periodically
  scaleInterval = setInterval(updateScaleDisplay, 200)
})

onDestroy(() => {
  metricsStore.unsubscribe()
  if (interactiveInstance) {
    interactiveInstance.destroy()
  }
  if (styleElement) {
    styleElement.remove()
  }
  if (scaleInterval) {
    clearInterval(scaleInterval)
  }
})
</script>

<svelte:head>
  <style>
    @keyframes shumoku-edge-flow {
      from { stroke-dashoffset: 24; }
      to { stroke-dashoffset: 0; }
    }
  </style>
</svelte:head>

<div
  class="shumoku-container"
  bind:this={container}
  role="img"
  aria-label="Network topology diagram"
>
  {#if loading}
    <div class="loading">Loading topology...</div>
  {:else if error}
    <div class="error">{error}</div>
  {:else}
    {@html svgContent}

    <!-- Zoom controls -->
    <div class="zoom-controls">
      <span class="zoom-level">{Math.round(scale * 100)}%</span>
      <button on:click={resetView} title="Reset View">⟲</button>
    </div>
  {/if}
</div>

<style>
  .shumoku-container {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    cursor: grab;
    background: #1e293b;
    background-image: radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px);
    background-size: 16px 16px;
  }

  .shumoku-container :global(svg) {
    width: 100%;
    height: 100%;
    display: block;
  }

  .loading, .error {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #64748b;
  }

  .error {
    color: #ef4444;
  }

  .zoom-controls {
    position: absolute;
    bottom: 16px;
    right: 16px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    background: rgba(30, 41, 59, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    backdrop-filter: blur(8px);
  }

  .zoom-controls button {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: #94a3b8;
    font-size: 16px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .zoom-controls button:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
  }

  .zoom-level {
    min-width: 48px;
    text-align: center;
    font-size: 12px;
    font-weight: 500;
    color: #94a3b8;
  }
</style>

