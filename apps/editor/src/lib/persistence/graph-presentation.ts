// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import { type NetworkPresentation, parseNetworkPresentation } from '@shumoku/core'

/** Project-row display payload; entity overrides live with their entity rows. */
export type GraphPresentation = Pick<NetworkPresentation, 'settings'>

export function parseGraphPresentation(value?: GraphPresentation): GraphPresentation {
  if (value && Object.keys(value).some((key) => key !== 'settings'))
    throw new Error('Project presentation supports only graph settings')
  const parsed = parseNetworkPresentation({ nodes: [], links: [], subgraphs: [], ...value })
  return parsed.settings === undefined ? {} : { settings: parsed.settings }
}
