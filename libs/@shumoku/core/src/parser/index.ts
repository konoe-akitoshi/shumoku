// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * YAML parser for shumoku network definitions
 */

// Hierarchical parser for multi-file diagrams
export type { FileResolver, HierarchicalParseResult } from './hierarchical.js'
export {
  createMemoryFileResolver,
  createNodeFileResolver,
  HierarchicalParser,
  isExportLink,
  isExportNode,
} from './hierarchical.js'
export type { ParseResult, ParseWarning } from './parser.js'
export { parser, YamlParser } from './parser.js'
