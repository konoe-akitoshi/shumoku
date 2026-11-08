// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * The contribution store: each source's contribution in the network model's shape. The codec itself lives in ../db/contribution-codec.ts; these default to the
 * server's database.
 */

import type { Database } from 'bun:sqlite'
import type { SourceNetwork } from '@shumoku/core'
import {
  buildNetwork as build,
  type IngestOptions as CodecIngestOptions,
  ingestNetwork as ingest,
} from '../db/contribution-codec.js'
import { getDatabase } from '../db/index.js'

/** What a source's contribution is written with: always owned by an attached source. */
export type IngestOptions = Omit<CodecIngestOptions, 'attachmentId'> & { attachmentId: string }

/**
 * Replace `(topologyId, sourceId)`'s contribution with `contribution`, in one transaction.
 * Refuses a contribution with no owning attachment: the hidden project overlay that used to be
 * written that way is gone, and an ownerless contribution would never be seen or cascaded away.
 */
export function ingestNetwork(
  topologyId: string,
  sourceId: string,
  contribution: SourceNetwork,
  opts: IngestOptions,
  db: Database = getDatabase(),
): void {
  // The type forbids null; this guards a caller that casts or reads the id from a nullable row.
  if (!opts.attachmentId) {
    throw new Error(`contribution ${topologyId}/${sourceId} needs an attachmentId`)
  }
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
