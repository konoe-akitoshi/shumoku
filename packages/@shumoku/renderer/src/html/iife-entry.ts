// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * IIFE entry point - exposes API to window.ShumokuInteractive
 */

import { initInteractive } from './runtime.js'

const ShumokuInteractive = { initInteractive }

;(window as unknown as { ShumokuInteractive: typeof ShumokuInteractive }).ShumokuInteractive =
  ShumokuInteractive

export { ShumokuInteractive }
