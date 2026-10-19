// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * The contribution store: each source's contribution, and the project's own, in the network
 * model's shape. The codec itself lives in ../db/contribution-codec.ts; these default to the
 * server's database.
 */

import type { Database } from 'bun:sqlite'
import type { SourceNetwork } from '@shumoku/core'
import {
  buildNetwork as build,
  type IngestOptions,
  ingestNetwork as ingest,
} from '../db/contribution-codec.js'
import { getDatabase } from '../db/index.js'

export type { IngestOptions }

/** Replace `(topologyId, sourceId)`'s contribution with `contribution`, in one transaction. */
export function ingestNetwork(
  topologyId: string,
  sourceId: string,
  contribution: SourceNetwork,
  opts: IngestOptions = {},
  db: Database = getDatabase(),
): void {
  ingest(topologyId, sourceId, contribution, opts, db)
}

/** Project `(topologyId, sourceId)`'s rows back to its contribution. */
export function buildNetwork(
  topologyId: string,
  sourceId: string,
  db: Database = getDatabase(),
): SourceNetwork | null {
  return build(topologyId, sourceId, db)
}
