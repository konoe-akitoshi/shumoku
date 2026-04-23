/**
 * Shared topology rendering kit: one `TopologyViewer` core + a
 * collection of composable overlay components. Every page that shows
 * a topology (dashboard widget, detail page, share page) should
 * compose from these rather than reinvent.
 *
 * Architecture:
 *
 *   <TopologyViewer graph sheetId theme mode interaction detail ...>
 *     {#snippet children({ svgElement, graph, sheetId, viewport })}
 *       <WeathermapOverlay {svgElement} metrics ... />
 *       <NodeStatusOverlay {svgElement} status />
 *       <HighlightOverlay  {svgElement} bind:this={highlight} />
 *       <TooltipOverlay    {svgElement} {graph} />
 *     {/snippet}
 *   </TopologyViewer>
 *
 * Each overlay is a plain Svelte component with a standard contract:
 * it receives `svgElement` plus its own feature-specific reactive
 * props, and handles its own DOM attachment / cleanup.
 */

export { default as HighlightOverlay } from './HighlightOverlay.svelte'
export { default as NodeStatusOverlay } from './NodeStatusOverlay.svelte'
export type { ElementKind, HoveredElement } from './TooltipOverlay.svelte'
export { default as TooltipOverlay } from './TooltipOverlay.svelte'
export type {
  DetailOptions,
  InteractionOptions,
  ViewerContext,
} from './TopologyViewer.svelte'
export { default as TopologyViewer } from './TopologyViewer.svelte'
export type { WeathermapAnimation } from './WeathermapOverlay.svelte'
export { default as WeathermapOverlay } from './WeathermapOverlay.svelte'
