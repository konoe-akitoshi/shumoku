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
 * Tried on a SpaceExplorer (Linux, with spacenavd running). `invertX` / `invertY` / `invertZ` flip
 * an axis.
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

/** SpaceExplorer button bits (Blender's `ndof_HID_map_SpaceExplorer`). */
export const SPACEEXPLORER_BUTTONS = {
  key1: 0,
  key2: 1,
  top: 2,
  left: 3,
  right: 4,
  front: 5,
  esc: 6,
  alt: 7,
  shift: 8,
  ctrl: 9,
  fit: 10,
  menu: 11,
  plus: 12,
  minus: 13,
  rotate: 14,
} as const satisfies SpaceMouseButtons

/** `vendorId:productId` → its buttons, after Blender's `GHOST_NDOFManager`. */
const MODELS: Record<string, SpaceMouseButtons> = {
  // SpaceMouse Pro, Pro Wireless (cable and receiver)
  '046d:c62b': SPACEMOUSE_PRO_BUTTONS,
  '256f:c62b': SPACEMOUSE_PRO_BUTTONS,
  '256f:c631': SPACEMOUSE_PRO_BUTTONS,
  '256f:c632': SPACEMOUSE_PRO_BUTTONS,
  '256f:c638': SPACEMOUSE_PRO_BUTTONS,
  // The universal receiver: Blender takes it for a Pro Wireless
  '256f:c652': SPACEMOUSE_PRO_BUTTONS,
  // SpacePilot Pro (Blender's shared table)
  '046d:c629': SPACEMOUSE_PRO_BUTTONS,
  // SpaceExplorer
  '046d:c627': SPACEEXPLORER_BUTTONS,
  // SpaceNavigator, SpaceNavigator for Notebooks, SpaceMouse Compact, SpaceMouse Wireless
  '046d:c626': SPACEMOUSE_TWO_BUTTONS,
  '046d:c628': SPACEMOUSE_TWO_BUTTONS,
  '256f:c635': SPACEMOUSE_TWO_BUTTONS,
  '256f:c62e': SPACEMOUSE_TWO_BUTTONS,
  '256f:c62f': SPACEMOUSE_TWO_BUTTONS,
  '256f:c658': SPACEMOUSE_TWO_BUTTONS,
}

const hex4 = (n: number) => n.toString(16).padStart(4, '0')

/**
 * The buttons of a model, by its USB ids. Models not listed (the Enterprise reports its buttons
 * differently) get none: the cap still moves the view, and no button can do something it was not
 * meant to.
 */
export const spaceMouseButtons = (vendorId: number, productId: number): SpaceMouseButtons =>
  MODELS[`${hex4(vendorId)}:${hex4(productId)}`] ?? {}

/** Whether the named button is down; false for a button the model does not have. */
export const isDown = (buttons: number, map: SpaceMouseButtons, name: string): boolean => {
  const bit = map[name]
  return bit !== undefined && (buttons & (1 << bit)) !== 0
}

// =========================================================================
// Response
// =========================================================================

/** The raw range of the axes (the devices' logical maximum; Blender divides by it too). */
const AXIS_RANGE = 350
/** Fraction of the range treated as rest. */
const DEADZONE = 0.04
/** The curve past the deadzone: 1 would be linear; 1.5 is gentle near rest, quick when pushed. */
const EXPONENT = 1.5
/** At full deflection: CSS px/s of pan, and ln of the zoom per second (2.5 ≈ ×12 a second). */
const PAN_SPEED = 2500
const ZOOM_SPEED = 2.5
/** The Shift button's slow mode. */
const PRECISE = 0.3

/** What a person sets for their device: the axes to flip, and a factor on the speed. */
export interface SpaceMouseSettings {
  invertX: boolean
  invertY: boolean
  invertZ: boolean
  speed: number
}

export const defaultSpaceMouseSettings = (): SpaceMouseSettings => ({
  invertX: false,
  invertY: false,
  invertZ: false,
  speed: 1,
})

/** −1…1 from a raw axis: zero inside the deadzone, then the response curve. */
export function axisResponse(raw: number): number {
  const a = Math.max(-1, Math.min(1, raw / AXIS_RANGE))
  const m = Math.abs(a)
  if (m <= DEADZONE) return 0
  return Math.sign(a) * ((m - DEADZONE) / (1 - DEADZONE)) ** EXPONENT
}

/**
 * The view's motion from the cap. Pushing the cap right moves the picture right (as if moving
 * the paper), pulling it up zooms in; only the stronger of pan and zoom passes, so a zoom does not
 * drift sideways. `precise` slows it (the Shift button).
 */
export function motionOf(
  state: SpaceMouseState,
  settings: SpaceMouseSettings,
  precise = false,
): Motion | null {
  const sign = (invert: boolean) => (invert ? -1 : 1)
  let x = axisResponse(state.tx) * sign(settings.invertX)
  let y = axisResponse(state.ty) * sign(settings.invertY)
  let z = -axisResponse(state.tz) * sign(settings.invertZ)
  if (Math.abs(z) > Math.hypot(x, y)) {
    x = 0
    y = 0
  } else {
    z = 0
  }
  if (x === 0 && y === 0 && z === 0) return null
  const scale = settings.speed * (precise ? PRECISE : 1)
  return { vx: x * PAN_SPEED * scale, vy: y * PAN_SPEED * scale, vz: z * ZOOM_SPEED * scale }
}

// =========================================================================
// WebHID
// =========================================================================

/** The part of WebHID used here (not in the DOM typings). */
interface HidCollection {
  readonly usagePage: number
  readonly usage: number
}
export interface HidDevice extends EventTarget {
  readonly opened: boolean
  readonly collections: readonly HidCollection[]
  readonly productId: number
  readonly productName: string
  readonly vendorId: number
  open(): Promise<void>
  close(): Promise<void>
}
interface HidInputReportEvent extends Event {
  readonly reportId: number
  readonly data: DataView
}
interface HidConnectionEvent extends Event {
  readonly device: HidDevice
}
interface Hid extends EventTarget {
  getDevices(): Promise<HidDevice[]>
  requestDevice(options: { filters: HidFilter[] }): Promise<HidDevice[]>
}
interface HidFilter {
  vendorId?: number
  usagePage?: number
  usage?: number
}

/** 3Dconnexion's vendor ids (Logitech's for older models), as a multi-axis controller. */
const SPACEMOUSE_FILTERS: HidFilter[] = [
  { vendorId: 0x256f, usagePage: 0x01, usage: 0x08 },
  { vendorId: 0x046d, usagePage: 0x01, usage: 0x08 },
]

/**
 * Whether a HID interface is a SpaceMouse's multi-axis controller. One device can show as several
 * interfaces, and 0x046d is Logitech's id for all its devices, so the usage decides, as the
 * request's filters do.
 */
export const isSpaceMouse = (d: {
  vendorId: number
  collections: readonly HidCollection[]
}): boolean =>
  (d.vendorId === 0x256f || d.vendorId === 0x046d) &&
  d.collections.some((c) => c.usagePage === 0x01 && c.usage === 0x08)

const hidOf = (): Hid | undefined =>
  typeof navigator !== 'undefined' && 'hid' in navigator ? (navigator.hid as Hid) : undefined

/**
 * Whether a SpaceMouse can be reached here: WebHID exists only in a secure context (HTTPS or
 * localhost) of Chrome / Edge, and only where the `hid` Permissions Policy allows it (not in
 * another site's frame unless it says `allow="hid"`).
 */
export function spaceMouseAvailability(): 'ok' | 'insecure' | 'blocked' | 'unsupported' {
  if (typeof window === 'undefined') return 'unsupported'
  if (!window.isSecureContext) return 'insecure'
  if (!hidOf()) return 'unsupported'
  const policy = (document as Document & { featurePolicy?: { allowsFeature(f: string): boolean } })
    .featurePolicy
  if (policy && !policy.allowsFeature('hid')) return 'blocked'
  return 'ok'
}

/** A SpaceMouse this site may already use (granted before, and still plugged in). */
export async function grantedSpaceMouse(): Promise<HidDevice | null> {
  const devices = (await hidOf()?.getDevices()) ?? []
  return devices.find(isSpaceMouse) ?? null
}

/**
 * Ask the user to pick a SpaceMouse. Call it straight from the click: the browser shows its picker
 * only within a user gesture. Null when the user picked nothing.
 */
export async function requestSpaceMouse(): Promise<HidDevice | null> {
  const devices = (await hidOf()?.requestDevice({ filters: SPACEMOUSE_FILTERS })) ?? []
  return devices.find(isSpaceMouse) ?? null
}

/** Call `listener` when a granted SpaceMouse is plugged in; returns the remover. */
export function onSpaceMousePlugged(listener: () => void): () => void {
  const hid = hidOf()
  if (!hid) return () => {}
  const onConnect = (e: Event) => {
    if (isSpaceMouse((e as HidConnectionEvent).device)) listener()
  }
  hid.addEventListener('connect', onConnect)
  return () => hid.removeEventListener('connect', onConnect)
}

export interface SpaceMouseConnection {
  readonly name: string
  /** The model's buttons (empty for a model not known). */
  readonly buttons: SpaceMouseButtons
  close(): Promise<void>
}

/**
 * Open a SpaceMouse: `onState` gets every new state, `onDisconnect` is called once when it goes.
 * Resolves to the connection, or to the error the browser gave (on Linux usually a missing udev
 * rule; on Windows / macOS 3DxWare may hold the device).
 */
export async function openSpaceMouse(
  device: HidDevice,
  on: {
    onState: (state: SpaceMouseState, previous: SpaceMouseState) => void
    onDisconnect: () => void
  },
): Promise<SpaceMouseConnection | { error: unknown }> {
  const hid = hidOf()
  if (!hid) return { error: new Error('WebHID is not available') }
  try {
    if (!device.opened) await device.open()
  } catch (error) {
    // Opened meanwhile by another open of the same device: use it.
    if (!device.opened) return { error }
  }

  let state = zeroState()
  const onReport = (e: Event) => {
    const r = e as HidInputReportEvent
    const next = parseReport(r.reportId, r.data, state)
    if (next === state) return
    const previous = state
    state = next
    on.onState(state, previous)
  }
  const detach = () => {
    device.removeEventListener('inputreport', onReport)
    hid.removeEventListener('disconnect', onDisconnect)
  }
  const onDisconnect = (e: Event) => {
    if ((e as HidConnectionEvent).device !== device) return
    detach()
    const previous = state
    state = zeroState()
    on.onState(state, previous)
    on.onDisconnect()
  }
  device.addEventListener('inputreport', onReport)
  hid.addEventListener('disconnect', onDisconnect)

  return {
    name: device.productName,
    buttons: spaceMouseButtons(device.vendorId, device.productId),
    async close() {
      detach()
      try {
        await device.close()
      } catch {
        // already closed
      }
    },
  }
}
