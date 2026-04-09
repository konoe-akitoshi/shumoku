// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * WebComponent wrapper for ShumokuRenderer
 * Usage: <shumoku-renderer></shumoku-renderer>
 * Set layout data via element.layout property or 'layout' attribute (JSON)
 */

import type { ResolvedLayout } from '@shumoku/core'
import { hydrate, mount } from 'svelte'
import ShumokuRenderer from './components/ShumokuRenderer.svelte'

class ShumokuRendererElement extends HTMLElement {
  private _layout: ResolvedLayout | null = null
  private _instance: ReturnType<typeof mount> | null = null

  constructor() {
    super()
    this.attachShadow({ mode: 'open' })
  }

  set layout(value: ResolvedLayout) {
    this._layout = value
    this._render()
  }

  get layout(): ResolvedLayout | null {
    return this._layout
  }

  connectedCallback() {
    if (this._layout) {
      this._render()
    }
  }

  private _render() {
    if (!this.shadowRoot || !this._layout) return

    const hasDSD = this.shadowRoot.innerHTML.trim() !== ''
    const props = {
      layout: this._layout,
      onnodemove: (id: string, x: number, y: number) => {
        this.dispatchEvent(
          new CustomEvent('nodemove', {
            detail: { id, x, y },
            bubbles: true,
            composed: true,
          }),
        )
      },
    }

    if (hasDSD && !this._instance) {
      // SSR → hydrate
      this._instance = hydrate(ShumokuRenderer, {
        target: this.shadowRoot,
        props,
      })
    } else if (!this._instance) {
      // CSR → mount
      this._instance = mount(ShumokuRenderer, {
        target: this.shadowRoot,
        props,
      })
    }
  }
}

if (typeof window !== 'undefined') {
  if (!customElements.get('shumoku-renderer')) {
    customElements.define('shumoku-renderer', ShumokuRendererElement)
  }
}

export { ShumokuRendererElement }
