// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * WebComponent wrapper for ShumokuRenderer
 *
 * Per-instance $state in class fields for reactive props.
 * mount() once — prop changes propagate automatically.
 */

import type { NetworkGraph, ResolvedLayout, Theme } from '@shumoku/core'
import type { ComponentProps } from 'svelte'
import { mount, unmount } from 'svelte'
import ShumokuRenderer from './components/ShumokuRenderer.svelte'

type RendererProps = ComponentProps<typeof ShumokuRenderer>

export class ShumokuRendererElement extends HTMLElement {
  // Per-instance reactive state (requires .svelte.ts extension)
  private _props = $state<RendererProps>({
    layout: {
      nodes: new Map(),
      ports: new Map(),
      edges: new Map(),
      subgraphs: new Map(),
      bounds: { x: 0, y: 0, width: 0, height: 0 },
    },
  })

  private _instance: ReturnType<typeof mount> | null = null
  private _mounted = false

  constructor() {
    super()
    this.attachShadow({ mode: 'open' })
  }

  // --- Props (setter updates $state, Svelte auto-reacts, no remount) ---

  set layout(value: ResolvedLayout) {
    this._props.layout = value
    if (!this._mounted) this._mount()
  }
  get layout(): ResolvedLayout | undefined {
    return this._props.layout
  }

  set graph(value: NetworkGraph | undefined) {
    this._props.graph = value ? { links: value.links } : undefined
  }
  get graph() {
    return this._props.graph as NetworkGraph | undefined
  }

  set theme(value: Theme | undefined) {
    this._props.theme = value
  }
  get theme() {
    return this._props.theme
  }

  set mode(value: 'view' | 'edit') {
    this._props.mode = value
  }
  get mode() {
    return this._props.mode ?? 'view'
  }

  // --- Callbacks (prefixed to avoid HTMLElement conflicts) ---

  set onshumokuselect(fn: RendererProps['onselect']) {
    this._props.onselect = fn
  }
  get onshumokuselect() {
    return this._props.onselect
  }

  set onshumokuchange(fn: RendererProps['onchange']) {
    this._props.onchange = fn
  }
  get onshumokuchange() {
    return this._props.onchange
  }

  set onshumokucontextmenu(fn: RendererProps['oncontextmenu']) {
    this._props.oncontextmenu = fn
  }
  get onshumokucontextmenu() {
    return this._props.oncontextmenu
  }

  set onshumokulabeledit(fn: RendererProps['onlabeledit']) {
    this._props.onlabeledit = fn
  }
  get onshumokulabeledit() {
    return this._props.onlabeledit
  }

  // --- Methods (delegate to Svelte component exports) ---

  addNewNode(opts?: { label?: string; position?: { x: number; y: number } }) {
    // biome-ignore lint/suspicious/noExplicitAny: Svelte mount() returns opaque type without component exports
    return (this._instance as any)?.addNewNode?.(opts)
  }
  addNewSubgraph(opts?: { label?: string; position?: { x: number; y: number } }) {
    // biome-ignore lint/suspicious/noExplicitAny: Svelte mount() returns opaque type without component exports
    return (this._instance as any)?.addNewSubgraph?.(opts)
  }
  commitLabel(portId: string, label: string) {
    // biome-ignore lint/suspicious/noExplicitAny: Svelte mount() returns opaque type without component exports
    ;(this._instance as any)?.commitLabel?.(portId, label)
  }
  getSnapshot() {
    // biome-ignore lint/suspicious/noExplicitAny: Svelte mount() returns opaque type without component exports
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
        // biome-ignore lint/suspicious/noExplicitAny: pre-upgrade property migration requires dynamic access
        const value = (this as any)[prop]
        // biome-ignore lint/suspicious/noExplicitAny: pre-upgrade property migration requires dynamic access
        delete (this as any)[prop]
        // biome-ignore lint/suspicious/noExplicitAny: pre-upgrade property migration requires dynamic access
        ;(this as any)[prop] = value
      }
    }
    if (this._props.layout?.nodes?.size && !this._mounted) this._mount()
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
      props: this._props,
    })
    this._mounted = true
  }
}

if (typeof window !== 'undefined') {
  if (!customElements.get('shumoku-renderer')) {
    customElements.define('shumoku-renderer', ShumokuRendererElement)
  }
}
