// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Plugin authoring kit — pure, browser-safe helpers shared by every data
 * source plugin (and reusable by the API/web). The audit found each plugin
 * had re-implemented these and drifted; this is the one home for them.
 *
 * Layer 1 of the 3-layer shared design (see
 * `apps/server/docs/design/plugin-contract-unification.md` §3.9): pure only.
 * Node-runtime helpers (HTTP client, pagination) live in `@shumoku/plugin-sdk`;
 * the timing-safe webhook guard lives in the server.
 */

export * from './alertmanager.js'
export * from './concurrency.js'
export * from './metrics-flatten.js'
export * from './secrets.js'
export * from './severity.js'
export * from './stamp.js'
export * from './topology-identity-contract.js'
export * from './validate-schema.js'
