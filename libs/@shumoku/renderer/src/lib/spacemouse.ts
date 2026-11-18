// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * A 3Dconnexion SpaceMouse as a camera input, through WebHID (Chrome and Edge, secure contexts).
 * It is a companion to the mouse: the cap pans and zooms the view, its buttons run view commands;
 * clicking and selecting stay with the mouse.
 *
 * Reports (data without the report id): 1 = translation, three int16 little-endian (some models
 * put the rotation in bytes 6-11 of the same report), 2 = rotation, 3 = the buttons as a bitmask.
 * The values run to about ±350. Each model numbers its buttons in its own way:
 * `spaceMouseButtons` names them for the models it knows, after Blender's tables. 3DxWare, when running, holds the device and no report arrives; on
 * Linux the hidraw node needs a udev rule.
 *
 * The axis directions are not verified on hardware: `invertX` / `invertY` / `invertZ` set them.
 */

import type { Motion } from './camera.js'

export interface SpaceMouseState {
  /** Raw translation and rotation, about ±350. */
  tx: number
  ty: number
  tz: number
  rx: number
  ry: number
  rz: number
  /** The pressed buttons as a bitmask (bit = button index). */
  buttons: number
}

export const zeroState = (): SpaceMouseState => ({
  tx: 0,
  ty: 0,
  tz: 0,
  rx: 0,
  ry: 0,
  rz: 0,
  buttons: 0,
})

/** The state after one input report. Unknown reports leave it as it was. */
export function parseReport(
  reportId: number,
  data: DataView,
  state: SpaceMouseState,
): SpaceMouseState {
  const i16 = (offset: number) => data.getInt16(offset, true)
  if (reportId === 1 && data.byteLength >= 6) {
    const next = { ...state, tx: i16(0), ty: i16(2), tz: i16(4) }
    if (data.byteLength >= 12) return { ...next, rx: i16(6), ry: i16(8), rz: i16(10) }
    return next
  }
  if (reportId === 2 && data.byteLength >= 6) {
    return { ...state, rx: i16(0), ry: i16(2), rz: i16(4) }
  }
  if (reportId === 3) {
    let buttons = 0
    for (const byte of [0, 1, 2, 3].slice(0, data.byteLength)) {
      buttons |= data.getUint8(byte) << (byte * 8)
    }
    return { ...state, buttons: buttons >>> 0 }
  }
  return state
}

/** A model's buttons: a name for each bit of the buttons report. */
export type SpaceMouseButtons = Readonly<Record<string, number>>

/** SpaceMouse Pro button bits (Blender's map; the Pro Wireless shares it). */
export const SPACEMOUSE_PRO_BUTTONS = {
  menu: 0,
  fit: 1,
  top: 2,
  right: 4,
  front: 5,
  roll: 8,
  key1: 12,
  key2: 13,
  key3: 14,
  key4: 15,
  esc: 22,
  alt: 23,
  shift: 24,
  ctrl: 25,
  rotationLock: 26,
} as const satisfies SpaceMouseButtons

/** The two-button models (SpaceNavigator, SpaceMouse Compact / Wireless): left is the menu, right fits. */
export const SPACEMOUSE_TWO_BUTTONS = { menu: 0, fit: 1 } as const satisfies SpaceMouseButtons

/** `vendorId:productId` → its buttons, after Blender's `GHOST_NDOFManager`. */
const MODELS: Record<string, SpaceMouseButtons> = {
  // SpaceMouse Pro, Pro Wireless (cable and receiver)
  '046d:c62b': SPACEMOUSE_PRO_BUTTONS,
  '256f:c62b': SPACEMOUSE_PRO_BUTTONS,
  '256f:c631': SPACEMOUSE_PRO_BUTTONS,
  '256f:c632': SPACEMOUSE_PRO_BUTTONS,
  // SpaceNavigator, SpaceNavigator for Notebooks, SpaceMouse Compact, SpaceMouse Wireless
  '046d:c626': SPACEMOUSE_TWO_BUTTONS,
  '046d:c628': SPACEMOUSE_TWO_BUTTONS,
  '256f:c635': SPACEMOUSE_TWO_BUTTONS,
  '256f:c62e': SPACEMOUSE_TWO_BUTTONS,
  '256f:c62f': SPACEMOUSE_TWO_BUTTONS,
}

const hex4 = (n: number) => n.toString(16).padStart(4, '0')

/**
 * The buttons of a model, by its USB ids. Models not listed (the Enterprise reports its buttons
 * differently, the universal receiver hides which device is behind it) get none: the cap still
 * moves the view, and no button can do something it was not meant to.
 */
export const spaceMouseButtons = (vendorId: number, productId: number): SpaceMouseButtons =>
  MODELS[`${hex4(vendorId)}:${hex4(productId)}`] ?? {}

/** Whether the named button is down; false for a button the model does not have. */
export const isDown = (buttons: number, map: SpaceMouseButtons, name: string): boolean => {
  const bit = map[name]
  return bit !== undefined && isPressed(buttons, bit)
}

export const isPressed = (buttons: number, bit: number) => (buttons & (1 << bit)) !== 0

export interface SpaceMouseSettings {
  /** Fraction of the range treated as rest. */
  deadzone: number
  /** Pan speed at full deflection, CSS px/s. */
  panSpeed: number
  /** Zoom speed at full deflection, ln of the zoom per second (2 ≈ ×7.4 a second). */
  zoomSpeed: number
  invertX: boolean
  invertY: boolean
  invertZ: boolean
  /** Pass only the stronger of pan and zoom, so a zoom does not drift sideways. */
  dominant: boolean
}

export const defaultSpaceMouseSettings = (): SpaceMouseSettings => ({
  deadzone: 0.06,
  panSpeed: 1600,
  zoomSpeed: 2,
  invertX: false,
  invertY: false,
  invertZ: false,
  dominant: true,
})

/** −1…1 from a raw axis: past the deadzone, squared for fine control near rest. */
export function axisResponse(raw: number, deadzone: number): number {
  const a = Math.max(-1, Math.min(1, raw / 350))
  const m = Math.abs(a)
  if (m <= deadzone) return 0
  const t = (m - deadzone) / (1 - deadzone)
  return Math.sign(a) * t * t
}

/**
 * The view's motion from the cap. Pushing the cap right moves the picture right (as if moving
 * the paper), pulling it up zooms in; `precise` slows it (the Shift button).
 */
export function motionOf(
  state: SpaceMouseState,
  settings: SpaceMouseSettings,
  precise = false,
): Motion | null {
  const sign = (invert: boolean) => (invert ? -1 : 1)
  let x = axisResponse(state.tx, settings.deadzone) * sign(settings.invertX)
  let y = axisResponse(state.ty, settings.deadzone) * sign(settings.invertY)
  let z = -axisResponse(state.tz, settings.deadzone) * sign(settings.invertZ)
  if (settings.dominant) {
    const pan = Math.hypot(x, y)
    if (Math.abs(z) > pan) {
      x = 0
      y = 0
    } else {
      z = 0
    }
  }
  if (x === 0 && y === 0 && z === 0) return null
  const scale = precise ? 0.3 : 1
  return {
    vx: x * settings.panSpeed * scale,
    vy: y * settings.panSpeed * scale,
    vz: z * settings.zoomSpeed * scale,
  }
}

// =========================================================================
// WebHID
// =========================================================================

/** The part of WebHID used here (not in the DOM typings). */
interface HidDevice extends EventTarget {
  readonly opened: boolean
  readonly productId: number
  readonly productName: string
  readonly vendorId: number
  open(): Promise<void>
  close(): Promise<void>
}
interface HidInputReportEvent extends Event {
  readonly reportId: number
  readonly data: DataView
  readonly device: HidDevice
}
interface Hid extends EventTarget {
  getDevices(): Promise<HidDevice[]>
  requestDevice(options: { filters: HidFilter[] }): Promise<HidDevice[]>
}
interface HidFilter {
  vendorId?: number
  productId?: number
  usagePage?: number
  usage?: number
}

/** 3Dconnexion's vendor ids (Logitech's for older models), as a multi-axis controller. */
export const SPACEMOUSE_FILTERS: HidFilter[] = [
  { vendorId: 0x256f, usagePage: 0x01, usage: 0x08 },
  { vendorId: 0x046d, usagePage: 0x01, usage: 0x08 },
]

const isSpaceMouse = (d: HidDevice) => d.vendorId === 0x256f || d.vendorId === 0x046d

const hidOf = (): Hid | undefined => {
  if (typeof navigator === 'undefined' || !('hid' in navigator)) return undefined
  return navigator.hid as Hid
}

/** Whether this browser can reach a SpaceMouse at all. */
export const spaceMouseSupported = () => hidOf() !== undefined

export type SpaceMouseStatus =
  /** No WebHID: not Chrome / Edge, not a secure context, or blocked by a Permissions Policy. */
  | { kind: 'unsupported' }
  /** No device has been granted yet: `request` needs a user gesture. */
  | { kind: 'needs-permission' }
  /** The device could not be opened: on Linux usually a missing udev rule, else another app. */
  | { kind: 'open-failed'; message: string }
  /** Opened; reports arrive only when the cap moves, and never while 3DxWare holds the device. */
  | { kind: 'connected'; name: string; buttons: SpaceMouseButtons }
  | { kind: 'disconnected' }

export interface SpaceMouseConnection {
  readonly name: string
  /** The model's buttons (empty for a model not known). */
  readonly buttons: SpaceMouseButtons
  close(): Promise<void>
}

/**
 * Open a SpaceMouse: one already granted to this site, or (with `request`, in a user gesture) one
 * the user picks. `onState` gets every new state, `onStatus` what happened.
 */
export async function openSpaceMouse(options: {
  request: boolean
  onState: (state: SpaceMouseState, previous: SpaceMouseState) => void
  onStatus: (status: SpaceMouseStatus) => void
}): Promise<SpaceMouseConnection | null> {
  const hid = hidOf()
  if (!hid) {
    options.onStatus({ kind: 'unsupported' })
    return null
  }
  let devices: HidDevice[]
  try {
    devices = options.request
      ? await hid.requestDevice({ filters: SPACEMOUSE_FILTERS })
      : (await hid.getDevices()).filter(isSpaceMouse)
  } catch (err) {
    options.onStatus({ kind: 'open-failed', message: String(err) })
    return null
  }
  const device = devices.find(isSpaceMouse)
  if (!device) {
    options.onStatus({ kind: 'needs-permission' })
    return null
  }
  try {
    if (!device.opened) await device.open()
  } catch (err) {
    options.onStatus({ kind: 'open-failed', message: String(err) })
    return null
  }

  let state = zeroState()
  const onReport = (e: Event) => {
    const r = e as HidInputReportEvent
    const next = parseReport(r.reportId, r.data, state)
    if (next === state) return
    const previous = state
    state = next
    options.onState(state, previous)
  }
  const onDisconnect = (e: Event) => {
    if ((e as Event & { device?: HidDevice }).device !== device) return
    const previous = state
    state = zeroState()
    options.onState(state, previous)
    options.onStatus({ kind: 'disconnected' })
  }
  device.addEventListener('inputreport', onReport)
  hid.addEventListener('disconnect', onDisconnect)
  const buttons = spaceMouseButtons(device.vendorId, device.productId)
  options.onStatus({ kind: 'connected', name: device.productName, buttons })

  return {
    name: device.productName,
    buttons,
    async close() {
      device.removeEventListener('inputreport', onReport)
      hid.removeEventListener('disconnect', onDisconnect)
      try {
        await device.close()
      } catch {
        // already closed
      }
    },
  }
}
