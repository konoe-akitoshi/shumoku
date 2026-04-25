// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * @shumoku/interactive — browser-only sidecar utilities for Shumoku
 * diagrams. Framework-agnostic: pair with `@shumoku/renderer` (Svelte),
 * the Web Component build, the static SVG / HTML output, or any other
 * code that produces a `<svg>` in the DOM.
 *
 * Package shape: pure JS (no Svelte / React / Vue dependency). Safe to
 * import from any browser-side bundler — Turbopack, Webpack, Rollup,
 * Vite, etc. — without per-bundler loader configuration.
 */

export { attachCamera, type Camera, type CameraOptions, type PanFilter } from './camera'
