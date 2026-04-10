// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * WebComponent wrapper for ShumokuRenderer
 *
 * Properties: layout, graph, theme, mode, viewBox
 * Events: shumoku-select, shumoku-change, shumoku-contextmenu
 */

import type { NetworkGraph, ResolvedLayout, Theme } from '@shumoku/core'
import { mount, unmount } from 'svelte'
import ShumokuRenderer from './components/ShumokuRenderer.svelte'

class ShumokuRendererElement extends HTMLElement {
  private _layout: ResolvedLayout | null = null
  private _graph: NetworkGraph | null = null
  private _theme: Theme | undefined = undefined
  private _mode: 'view' | 'edit' = 'view'
  private _viewBox: string | undefined = undefined
  private _instance: ReturnType<typeof mount> | null = null

  constructor() {
    super()
    this.attachShadow({ mode: 'open' })
  }

  set layout(value: ResolvedLayout) {
    this._layout = value
    this._tryRender()
  }
  get layout(): ResolvedLayout | null {
    return this._layout
  }

  set graph(value: NetworkGraph) {
    this._graph = value
    this._tryRender()
  }
  get graph(): NetworkGraph | null {
    return this._graph
  }

  set theme(value: Theme) {
    this._theme = value
    this._tryRender()
  }
  get theme(): Theme | undefined {
    return this._theme
  }

  set mode(value: 'view' | 'edit') {
    this._mode = value
    this._tryRender()
  }
  get mode(): 'view' | 'edit' {
    return this._mode
  }

  set viewBox(value: string | undefined) {
    this._viewBox = value
    this._tryRender()
  }
  get viewBox(): string | undefined {
    return this._viewBox
  }

  get svgElement(): SVGSVGElement | null {
    return this.shadowRoot?.querySelector('svg') ?? null
  }

  connectedCallback() {
    this._tryRender()
  }
  disconnectedCallback() {
    if (this._instance) {
      unmount(this._instance)
      this._instance = null
    }
  }

  private _tryRender() {
    if (!this.shadowRoot || !this._layout) return
    if (this._instance) {
      unmount(this._instance)
      this._instance = null
    }

    this._instance = mount(ShumokuRenderer, {
      target: this.shadowRoot,
      props: {
        layout: this._layout,
        graph: this._graph ?? undefined,
        theme: this._theme,
        mode: this._mode,
        viewBox: this._viewBox,
        onselect: (id: string | null, type: string | null) => {
          this.dispatchEvent(
            new CustomEvent('shumoku-select', {
              detail: { id, type },
              bubbles: true,
              composed: true,
            }),
          )
        },
        onchange: (links: unknown[]) => {
          this.dispatchEvent(
            new CustomEvent('shumoku-change', { detail: { links }, bubbles: true, composed: true }),
          )
        },
        oncontextmenu: (id: string, type: string, screenX: number, screenY: number) => {
          this.dispatchEvent(
            new CustomEvent('shumoku-contextmenu', {
              detail: { id, type, screenX, screenY },
              bubbles: true,
              composed: true,
            }),
          )
        },
      },
    })
  }
}

if (typeof window !== 'undefined') {
  if (!customElements.get('shumoku-renderer')) {
    customElements.define('shumoku-renderer', ShumokuRendererElement)
  }
}

export { ShumokuRendererElement }
