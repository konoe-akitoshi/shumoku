// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * @shumoku/plugin-sdk — Node-runtime helpers for data source plugins.
 *
 * Layer 2 of the 3-layer shared design: HTTP + pagination, which require Node
 * (fetch dispatcher/TLS) and so cannot live in the browser-safe `@shumoku/core`.
 * Pure helpers (severity, alertmanager, flatten, stamp, validate) are in
 * `@shumoku/core/plugin-kit`; the webhook guard lives in the server.
 */

export * from './http-client.js'
export * from './paginate.js'
