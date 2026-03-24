// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

export { StraightRouter } from './straight.js'
export { OrthogonalRouter } from './orthogonal.js'
export { SplineRouter } from './spline.js'

import type { RoutingEngine, RoutingStrategy } from '../types.js'
import { OrthogonalRouter } from './orthogonal.js'
import { SplineRouter } from './spline.js'
import { StraightRouter } from './straight.js'

/** Create a routing engine by strategy name */
export function createRouter(strategy: RoutingStrategy): RoutingEngine {
  switch (strategy) {
    case 'straight':
      return new StraightRouter()
    case 'orthogonal':
      return new OrthogonalRouter()
    case 'spline':
      return new SplineRouter()
  }
}
