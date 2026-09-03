// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Node.js entry point for hierarchical YAML parsing from the filesystem.
 */

export type { FileResolver, HierarchicalParseResult } from './hierarchical.js'
export { createNodeFileResolver, HierarchicalParser } from './hierarchical.js'
