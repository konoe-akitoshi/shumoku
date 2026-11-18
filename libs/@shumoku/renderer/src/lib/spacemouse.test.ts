// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import {
  axisResponse,
  defaultSpaceMouseSettings,
  isDown,
  isPressed,
  motionOf,
  parseReport,
  SPACEMOUSE_PRO_BUTTONS,
  SPACEMOUSE_TWO_BUTTONS,
  spaceMouseButtons,
  zeroState,
} from './spacemouse.js'

const view = (...values: number[]) => {
  const buf = new ArrayBuffer(values.length * 2)
  const dv = new DataView(buf)
  for (const [i, v] of values.entries()) dv.setInt16(i * 2, v, true)
  return dv
}
const bytes = (...values: number[]) => new DataView(new Uint8Array(values).buffer)

describe('parseReport', () => {
  it('reads the translation (report 1)', () => {
    const s = parseReport(1, view(120, -40, 350), zeroState())
    expect([s.tx, s.ty, s.tz]).toEqual([120, -40, 350])
  })

  it('reads a rotation sent in the same report', () => {
    const s = parseReport(1, view(1, 2, 3, 4, 5, 6), zeroState())
    expect([s.rx, s.ry, s.rz]).toEqual([4, 5, 6])
  })

  it('reads the rotation (report 2) and keeps the translation', () => {
    const s = parseReport(2, view(7, 8, 9), { ...zeroState(), tx: 5 })
    expect([s.tx, s.rx, s.ry, s.rz]).toEqual([5, 7, 8, 9])
  })

  it('reads the buttons (report 3), little-endian across bytes', () => {
    // Fit (bit 1) and Shift (bit 24)
    const s = parseReport(3, bytes(0b10, 0, 0, 0b1), zeroState())
    expect(isPressed(s.buttons, SPACEMOUSE_PRO_BUTTONS.fit)).toBe(true)
    expect(isPressed(s.buttons, SPACEMOUSE_PRO_BUTTONS.shift)).toBe(true)
    expect(isPressed(s.buttons, SPACEMOUSE_PRO_BUTTONS.menu)).toBe(false)
  })

  it('leaves the state alone for other reports', () => {
    const s = zeroState()
    expect(parseReport(4, bytes(1), s)).toBe(s)
  })
})

describe('axisResponse', () => {
  it('is zero inside the deadzone', () => {
    expect(axisResponse(15, 0.06)).toBe(0)
    expect(axisResponse(-15, 0.06)).toBe(0)
  })

  it('reaches ±1 at full deflection and clamps beyond', () => {
    expect(axisResponse(350, 0.06)).toBeCloseTo(1)
    expect(axisResponse(-1400, 0.06)).toBeCloseTo(-1)
  })

  it('is gentle near rest (squared)', () => {
    expect(axisResponse(175, 0)).toBeCloseTo(0.25)
  })
})

describe('motionOf', () => {
  const settings = defaultSpaceMouseSettings()

  it('is nothing at rest', () => {
    expect(motionOf(zeroState(), settings)).toBeNull()
  })

  it('pans with the cap pushed sideways', () => {
    const m = motionOf({ ...zeroState(), tx: 350 }, settings)
    expect(m?.vx).toBeCloseTo(settings.panSpeed)
    expect(m?.vz).toBe(0)
  })

  it('zooms in with the cap pulled up', () => {
    const m = motionOf({ ...zeroState(), tz: -350 }, settings)
    expect(m?.vz).toBeCloseTo(settings.zoomSpeed)
  })

  it('passes only the stronger of pan and zoom', () => {
    const m = motionOf({ ...zeroState(), tx: 60, tz: -300 }, settings)
    expect(m?.vx).toBe(0)
    expect(m?.vz).toBeGreaterThan(0)
  })

  it('passes both when not dominant', () => {
    const m = motionOf({ ...zeroState(), tx: 200, tz: -300 }, { ...settings, dominant: false })
    expect(m?.vx).toBeGreaterThan(0)
    expect(m?.vz).toBeGreaterThan(0)
  })

  it('inverts an axis on request', () => {
    const m = motionOf({ ...zeroState(), ty: 350 }, { ...settings, invertY: true })
    expect(m?.vy).toBeCloseTo(-settings.panSpeed)
  })

  it('slows down when precise', () => {
    const m = motionOf({ ...zeroState(), tx: 350 }, settings, true)
    expect(m?.vx).toBeCloseTo(settings.panSpeed * 0.3)
  })
})

describe('spaceMouseButtons', () => {
  it('names the Pro buttons, by either vendor id', () => {
    expect(spaceMouseButtons(0x046d, 0xc62b)).toBe(SPACEMOUSE_PRO_BUTTONS)
    expect(spaceMouseButtons(0x256f, 0xc632)).toBe(SPACEMOUSE_PRO_BUTTONS)
  })

  it('names the two buttons of a Compact', () => {
    expect(spaceMouseButtons(0x256f, 0xc635)).toBe(SPACEMOUSE_TWO_BUTTONS)
  })

  it('gives an unknown model no buttons', () => {
    const map = spaceMouseButtons(0x256f, 0xc633)
    expect(isDown(0xffffffff, map, 'fit')).toBe(false)
  })

  it('reads a named button through the map', () => {
    expect(isDown(1 << 24, SPACEMOUSE_PRO_BUTTONS, 'shift')).toBe(true)
    expect(isDown(1 << 24, SPACEMOUSE_TWO_BUTTONS, 'shift')).toBe(false)
  })
})
