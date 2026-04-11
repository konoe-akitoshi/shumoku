// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * WebComponent wrapper for ShumokuRenderer
 *
 * Module-level $state for reactive props.
 * mount() once — prop changes propagate automatically.
 */

import type { NetworkGraph, ResolvedLayout, Theme } from '@shumoku/core'
import type { ComponentProps } from 'svelte'
import { mount, unmount } from 'svelte'
import ShumokuRenderer from './components/ShumokuRenderer.svelte'

type RendererProps = ComponentProps<typeof ShumokuRenderer>

// Module-level $state — verified to work with mount() reactivity
const props = $state<RendererProps>({
  layout: {
    nodes: new Map(),
    ports: new Map(),
    edges: new Map(),
    subgraphs: new Map(),
    bounds: { x: 0, y: 0, width: 0, height: 0 },
  },
})

export class ShumokuRendererElement extends HTMLElement {
  private _instance: ReturnType<typeof mount> | null = null
  private _mounted = false

  constructor() {
    super()
    this.attachShadow({ mode: 'open' })
  }

  // --- Props (setter updates $state, Svelte auto-reacts, no remount) ---

  set layout(value: ResolvedLayout) {
    props.layout = value
    if (!this._mounted) this._mount()
  }
  get layout() {
    return props.layout
  }

  set graph(value: NetworkGraph | undefined) {
    props.graph = value ? { links: value.links } : undefined
  }
  get graph() {
    return props.graph as NetworkGraph | undefined
  }

  set theme(value: Theme | undefined) {
    props.theme = value
  }
  get theme() {
    return props.theme
  }

  set mode(value: 'view' | 'edit') {
    props.mode = value
  }
  get mode() {
    return props.mode ?? 'view'
  }

  // --- Callbacks (prefixed to avoid HTMLElement conflicts) ---

  set onshumokuselect(fn: RendererProps['onselect']) {
    props.onselect = fn
  }
  get onshumokuselect() {
    return props.onselect
  }

  set onshumokuchange(fn: RendererProps['onchange']) {
    props.onchange = fn
  }
  get onshumokuchange() {
    return props.onchange
  }

  set onshumokucontextmenu(fn: RendererProps['oncontextmenu']) {
    props.oncontextmenu = fn
  }
  get onshumokucontextmenu() {
    return props.oncontextmenu
  }

  set onshumokulabeledit(fn: RendererProps['onlabeledit']) {
    props.onlabeledit = fn
  }
  get onshumokulabeledit() {
    return props.onlabeledit
  }

  // --- Methods (delegate to Svelte component exports) ---

  // biome-ignore lint/suspicious/noExplicitAny: Svelte mount exports
  addNewNode(opts?: any) {
    return (this._instance as any)?.addNewNode?.(opts)
  }
  // biome-ignore lint/suspicious/noExplicitAny: Svelte mount exports
  addNewSubgraph(opts?: any) {
    return (this._instance as any)?.addNewSubgraph?.(opts)
  }
  commitLabel(portId: string, label: string) {
    ;(this._instance as any)?.commitLabel?.(portId, label)
  }
  getSnapshot() {
    return (this._instance as any)?.getSnapshot?.() ?? null
  }

  // --- SVG ---

  get svgElement(): SVGSVGElement | null {
    return this.shadowRoot?.querySelector('svg') ?? null
  }

  // --- Lifecycle ---

  connectedCallback() {
    // Migrate pre-upgrade plain properties to $state setters
    // (properties set before customElements.define shadow class setters)
    for (const prop of [
      'layout',
      'graph',
      'theme',
      'mode',
      'onshumokuselect',
      'onshumokuchange',
      'onshumokucontextmenu',
      'onshumokulabeledit',
    ] as const) {
      if (Object.hasOwn(this, prop)) {
        const value = (this as any)[prop]
        delete (this as any)[prop] // Remove plain property, expose class setter
        ;(this as any)[prop] = value // Re-set via class setter → updates $state
      }
    }
    if (props.layout.nodes.size > 0 && !this._mounted) this._mount()
  }

  disconnectedCallback() {
    if (this._instance) {
      unmount(this._instance)
      this._instance = null
      this._mounted = false
    }
  }

  private _mount() {
    if (!this.shadowRoot) return
    if (this._instance) unmount(this._instance)
    this._instance = mount(ShumokuRenderer, {
      target: this.shadowRoot,
      props,
    })
    this._mounted = true
  }
}

if (typeof window !== 'undefined') {
  if (!customElements.get('shumoku-renderer')) {
    customElements.define('shumoku-renderer', ShumokuRendererElement)
  }
}
