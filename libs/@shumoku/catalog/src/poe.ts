// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * IEEE 802.3 PoE reservation constants.
 *
 * A PSE reserves a fixed amount of power per port based on the PD's classification,
 * regardless of the PD's actual instantaneous draw. Using the catalog `max_draw_w`
 * for budget planning underestimates PSE consumption; engineers must size against
 * class-based reservation.
 */

/** PoE standards recognized by the catalog. */
export type PoEStandard = '802.3af' | '802.3at' | '802.3bt'

/**
 * Per-port watts reserved by a PSE when the PD classifies at the given class.
 *
 * Values follow the IEEE 802.3 standard worst-case power each class may draw at the
 * PSE (PI) side. A PSE that sees a Class 4 PD reserves 30 W even if the device
 * actually draws 12 W.
 *
 * Class 0 is treated as Class 3 (15.4 W) per historical convention — an unclassified
 * device may draw up to Class 3's limit.
 */
export const POE_CLASS_RESERVATION_W: Record<number, number> = {
  0: 15.4,
  1: 4,
  2: 7,
  3: 15.4,
  4: 30,
  5: 45,
  6: 60,
  7: 75,
  8: 90,
}

/** Highest class each PoE standard natively supports. */
export const POE_STANDARD_MAX_CLASS: Record<PoEStandard, number> = {
  '802.3af': 3,
  '802.3at': 4,
  '802.3bt': 8,
}

/**
 * Resolve the effective class negotiated between a PD and a PSE.
 *
 * A PD may support up to `pdClass` (under `pdStandard`), but the PSE may only
 * power up to `pseStandard`'s max class. The actual reservation uses whichever
 * is lower. Undefined inputs fall back to the best information available.
 */
export function effectivePoeClass(
  pdClass: number | undefined,
  pseStandard: string | undefined,
): number | undefined {
  if (pdClass === undefined) return undefined
  if (pseStandard === undefined) return pdClass
  const pseMax = POE_STANDARD_MAX_CLASS[pseStandard as PoEStandard]
  if (pseMax === undefined) return pdClass
  return Math.min(pdClass, pseMax)
}

/**
 * Watts a PSE reserves for a port given the effective class.
 * Returns undefined when the class is unknown (caller falls back to `max_draw_w`).
 */
export function classReservationW(effectiveClass: number | undefined): number | undefined {
  if (effectiveClass === undefined) return undefined
  return POE_CLASS_RESERVATION_W[effectiveClass]
}
