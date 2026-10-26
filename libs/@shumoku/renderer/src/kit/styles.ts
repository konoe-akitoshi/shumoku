// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/** The text styles of the kit, one rule per role in `tokens.ts`. */

import type { RenderColors } from '../lib/render-colors'
import { FONT_WEIGHT, type TextRole, type Tokens } from './tokens'

const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
const MONO = 'ui-monospace, "JetBrains Mono", "SF Mono", Menlo, Consolas, monospace'

export function kitStyles(tokens: Tokens, colors: RenderColors): string {
  const size = (role: TextRole) => `font-size: ${tokens.text[role].fontSize}px;`
  const tracking = `letter-spacing: ${tokens.tracking}em;`
  return `
    .node-label { font-family: ${SANS}; ${size('nodeTitle')} font-weight: ${FONT_WEIGHT.strong}; fill: ${colors.nodeText}; }
    .node-label-bold { font-weight: ${FONT_WEIGHT.bold}; }
    .node-label-secondary { font-family: ${MONO}; ${size('nodeText')} font-weight: ${FONT_WEIGHT.regular}; fill: ${colors.nodeTextSecondary}; }
    .node-subtitle, .node-fact-key { font-family: ${SANS}; ${size('nodeText')} fill: ${colors.nodeTextSecondary}; }
    .node-fact-value { font-family: ${MONO}; ${size('nodeText')} fill: ${colors.nodeText}; }
    .node-badge text { font-family: ${MONO}; ${size('badge')} font-weight: ${FONT_WEIGHT.strong}; fill: ${colors.nodeText}; }
    .node-icon { color: ${colors.nodeTextSecondary}; }
    .subgraph-label { font-family: ${SANS}; ${size('groupLabel')} font-weight: ${FONT_WEIGHT.bold}; text-transform: uppercase; ${tracking} }
    .link-label { font-family: ${MONO}; ${size('linkCaption')} fill: ${colors.textSecondary}; }
    .port-label-text { font-family: ${MONO}; ${size('portLabel')} }
    .ha-hull-label { font-family: ${MONO}; ${size('hullLabel')} font-weight: ${FONT_WEIGHT.strong}; ${tracking} }
  `
}
