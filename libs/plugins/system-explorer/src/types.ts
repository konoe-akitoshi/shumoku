// Copyright (C) 2026 system_explorer contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Configuration for the System Explorer data source.
 *
 * The plugin ships a fixed set of public samples (see `data/` and
 * `generated-data.ts`). `sample` selects which one `fetchTopology()` returns;
 * `viewerUrl` (optional) is a standalone system_explorer deployment the host
 * can hand to the Embed widget.
 */
export interface SystemExplorerPluginConfig {
  /** Sample id to expose as the topology (default: the first bundled sample). */
  sample?: string
  /** Base URL of a standalone system_explorer deployment (for embedding). */
  viewerUrl?: string
}
