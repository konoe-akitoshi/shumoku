// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * WebComponent wrapper for ShumokuRenderer
 * Usage: <shumoku-renderer></shumoku-renderer>
 * Set layout, graph, theme, and mode via element properties.
 */

import type { NetworkGraph, ResolvedLayout, Theme } from '@shumoku/core'
import { mount, unmount } from 'svelte'
import ShumokuRenderer from './components/ShumokuRenderer.svelte'

class ShumokuRendererElement extends HTMLElement {
  private _layout: ResolvedLayout | null = null
  private _graph: NetworkGraph | null = null
  private _theme: Theme | undefined = undefined
  private _mode: 'view' | 'edit' = 'view'
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
        onselect: (id: string | null, type: string | null) => {
          this.dispatchEvent(new CustomEvent('shumoku-select', {
            detail: { id, type },
            bubbles: true,
            composed: true,
          }))
        },
        onchange: (links: any[]) => {
          this.dispatchEvent(new CustomEvent('shumoku-change', {
            detail: { links },
            bubbles: true,
            composed: true,
          }))
        },
        mode: this._mode,
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
