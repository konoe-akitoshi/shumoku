// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Legacy LayoutResult renderer compatibility boundary.
 *
 * New code must use `@shumoku/renderer/static` or the canonical pipeline from
 * `@shumoku/renderer-svg`. Keeping every old renderer export behind this file
 * makes the implementation removable as one compatibility unit.
 */
import * as svg from './svg.js'

export type { RenderOptions, SVGRendererOptions } from './svg.js'
export { render, renderAsync, SVGRenderer, SVGRenderer as LegacySVGRenderer } from './svg.js'
export { svg }
