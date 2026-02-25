/**
 * IIFE entry point - exposes API to window.ShumokuInteractive
 */

import { initInteractive } from './runtime.js'

const ShumokuInteractive = { initInteractive }

;(window as unknown as { ShumokuInteractive: typeof ShumokuInteractive }).ShumokuInteractive =
  ShumokuInteractive

export { ShumokuInteractive }
