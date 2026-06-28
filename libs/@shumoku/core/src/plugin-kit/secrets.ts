// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Secret field identification, schema-driven.
 *
 * Secret-ness is declared once on the schema (`secret: true`, or legacy
 * `format: 'password'`). The host renders such fields masked with a reveal
 * toggle and suppresses password-manager autofill — a single definition both
 * the web form and any plugin can share, with no per-plugin branches and no
 * hard-coded field-name lists.
 */

import type { PluginConfigProperty } from '../plugin-types.js'

/**
 * A field is a write-only secret if it declares `secret: true`. `format:
 * 'password'` is honoured too so external plugins that predate the flag keep
 * working; new schemas should set `secret: true`.
 */
export function isSecretProp(prop: PluginConfigProperty): boolean {
  return prop.secret === true || prop.format === 'password'
}
