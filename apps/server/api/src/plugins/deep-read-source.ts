// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * The built-in source a topology's device reads (SNMP) are written under. Like Manual it has no
 * upstream to pull: its observations are written by the Read action, which asks the devices only
 * when a person presses it. So it has no capability, a sync keeps what it holds as stored (a
 * Rebuild must not drop a reading it cannot make again), and there is nothing for a health check
 * to reach. It is not a registered plugin type: nobody creates one, the Server does.
 */

import type { ConnectionResult, DataSourceCapability, DataSourcePlugin } from '@shumoku/core'

/** The data-source type (and id) of the built-in device-read source. */
export const DEEP_READ_TYPE = 'deep-read'

export class DeepReadSource implements DataSourcePlugin {
  readonly type = DEEP_READ_TYPE
  readonly displayName = 'Deep read (SNMP)'
  readonly capabilities: readonly DataSourceCapability[] = []

  initialize(_config: unknown): void {}

  async testConnection(): Promise<ConnectionResult> {
    return { success: true, message: 'Written by device reads; nothing to reach' }
  }
}
