// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

// Interactive renderer (browser)
export { default as ShumokuRenderer } from './components/ShumokuRenderer.svelte'

// Static SVG rendering (CLI, PNG, SSR)
export { renderGraphToSvg, renderSvgString } from './static'
