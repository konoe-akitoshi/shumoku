// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * The SpaceMouse as a companion to the mouse, for every diagram on the page: the cap pans and
 * zooms, Fit fits, Shift (held) slows the cap down. One device per page; each camera that attaches
 * can be driven, and the one the pointer is over (else the one it was last over, else the last
 * attached) is. Connecting needs a click once (`connectSpaceMouse`); afterwards a granted device
 * is opened when a camera attaches and when it is plugged back in. Chrome keeps the grant only for
 * devices with a serial number: one without (a SpaceExplorer) is picked again after unplugging.
 *
 * Browser only (WebHID: Chrome / Edge, HTTPS or localhost). Nothing runs when the module is
 * loaded, so a server render can import it. Settings live in this browser:
 * - `localStorage['shumoku.spacemouse.invert'] = 'x,y,z'` flips axes (any of them);
 * - `localStorage['shumoku.spacemouse.speed'] = '1.5'` scales the speed;
 * - `localStorage['shumoku.spacemouse.debug'] = '1'` logs every report.
 */

import type { Camera, MotionHandle } from './camera.js'
import {
  defaultSpaceMouseSettings,
  grantedSpaceMouse,
  type HidDevice,
  isDown,
  motionOf,
  onSpaceMousePlugged,
  openSpaceMouse,
  requestSpaceMouse,
  type SpaceMouseConnection,
  type SpaceMouseSettings,
  type SpaceMouseState,
  spaceMouseAvailability,
} from './spacemouse.js'

const stored = (key: string): string => {
  try {
    return localStorage.getItem(key) ?? ''
  } catch {
    return ''
  }
}

function readSettings(): SpaceMouseSettings {
  const invert = stored('shumoku.spacemouse.invert').split(',')
  const speed = Number.parseFloat(stored('shumoku.spacemouse.speed'))
  return {
    ...defaultSpaceMouseSettings(),
    invertX: invert.includes('x'),
    invertY: invert.includes('y'),
    invertZ: invert.includes('z'),
    ...(speed > 0 && { speed }),
  }
}

/**
 * Which of the attached cameras the device drives: the one the pointer is over, else the one it
 * was over last (if still attached), else the one attached last.
 */
export function pickCamera<C extends { isPointerOver(): boolean }>(
  cameras: readonly C[],
  last: C | null,
): C | null {
  return (
    cameras.find((c) => c.isPointerOver()) ??
    (last && cameras.includes(last) ? last : null) ??
    cameras.at(-1) ??
    null
  )
}

interface Attached {
  camera: Camera
  motion: MotionHandle
}

let settings = defaultSpaceMouseSettings()
let debug = false
let connection: SpaceMouseConnection | null = null
let state: SpaceMouseState | null = null
const attached: Attached[] = []
/** The camera driven last (the pointer was over it, or it was the only choice). */
let driven: Camera | null = null
const listeners = new Set<() => void>()
/** Page-wide listeners, set up with the first camera and removed with the last. */
let unlisten: (() => void) | null = null
/** Opens run one after another, so a reconnect and a click never open the device twice. */
let queue: Promise<unknown> = Promise.resolve()

const notify = () => {
  for (const l of listeners) l()
}

function sampleFor(camera: Camera) {
  // Read once a frame: nothing changes here, only whether this camera is the one driven.
  return () => {
    if (!state || !document.hasFocus() || driven !== camera) return null
    return motionOf(state, settings, isDown(state.buttons, connection?.buttons ?? {}, 'shift'))
  }
}

function onState(next: SpaceMouseState, previous: SpaceMouseState) {
  state = next
  if (debug) console.info('[spacemouse]', next)
  // The device follows the window's focus, buttons and cap alike.
  if (!document.hasFocus()) return
  driven = pickCamera(
    attached.map((a) => a.camera),
    driven,
  )
  const buttons = connection?.buttons ?? {}
  if (driven && isDown(next.buttons & ~previous.buttons, buttons, 'fit')) driven.reset()
  for (const a of attached) a.motion.wake()
}

function onDisconnect() {
  connection = null
  state = null
  notify()
}

/** What to tell the user when a SpaceMouse cannot be used here. */
function problem(reason: 'insecure' | 'blocked' | 'unsupported' | { error: unknown }): string {
  if (reason === 'insecure') {
    return 'A SpaceMouse needs this page to be opened over HTTPS (or on localhost): browsers allow WebHID only there.'
  }
  if (reason === 'unsupported')
    return 'A SpaceMouse needs WebHID: open this page in Chrome or Edge.'
  if (
    reason === 'blocked' ||
    (reason.error instanceof DOMException && reason.error.name === 'SecurityError')
  ) {
    return 'This page may not use a SpaceMouse here (it is shown inside another site; the frame needs allow="hid").'
  }
  return `The SpaceMouse could not be opened (${String(reason.error)}). On Linux, add a udev rule giving your user access to its hidraw device (spacenavd can keep running). On Windows / macOS, 3DxWare may be holding it.`
}

/** Open a device unless one is open already; the problem to tell the user, else null. */
async function use(device: HidDevice | null): Promise<string | null> {
  if (connection || !device) return null
  settings = readSettings()
  debug = stored('shumoku.spacemouse.debug') === '1'
  const opened = await openSpaceMouse(device, { onState, onDisconnect })
  if ('error' in opened) return problem(opened)
  connection = opened
  console.info(`[spacemouse] connected: ${opened.name}`)
  notify()
  return null
}

/** Run opens one at a time. */
function serial<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task)
  queue = run.catch(() => {})
  return run
}

/** Open a SpaceMouse granted before, if one is plugged in. */
function reconnect(): void {
  void serial(async () => {
    if (connection) return
    const message = await use(await grantedSpaceMouse())
    if (message) console.warn(`[spacemouse] ${message}`)
  })
}

/**
 * Connect, from a click: the browser's picker opens at once (it must, within the gesture), the
 * first time; the device is then opened after any reconnect in flight. Resolves to a message for
 * the user when it cannot work (not HTTPS, no WebHID, the device not openable), else null.
 */
export function connectSpaceMouse(): Promise<string | null> {
  const availability = spaceMouseAvailability()
  if (availability !== 'ok') return Promise.resolve(problem(availability))
  const picked = requestSpaceMouse()
  // Awaited below, maybe after a reconnect: not an unhandled rejection meanwhile.
  picked.catch(() => {})
  return serial(async () => {
    try {
      return await use(await picked)
    } catch (error) {
      return problem({ error })
    }
  })
}

/**
 * Whether to offer connecting here: `ok` when it can work, `insecure` when only HTTPS is missing
 * (worth a button that says so), else not at all.
 */
export const spaceMouseOffer = (): 'ok' | 'insecure' | 'none' => {
  const availability = spaceMouseAvailability()
  return availability === 'ok' || availability === 'insecure' ? availability : 'none'
}

/** Whether a SpaceMouse is connected now. */
export const spaceMouseConnected = () => connection !== null

/** Call `listener` whenever the SpaceMouse connects or goes; returns the remover. */
export function onSpaceMouseChange(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Let the SpaceMouse drive a camera; returns the detach. Opens a granted device. */
export function attachSpaceMouse(camera: Camera): () => void {
  const entry: Attached = { camera, motion: camera.addMotion(sampleFor(camera)) }
  attached.push(entry)
  if (spaceMouseAvailability() === 'ok') {
    if (!unlisten) {
      // A report that stops on blur would leave the cap held; let go of it.
      const onBlur = () => {
        if (state) state = { ...state, tx: 0, ty: 0, tz: 0, rx: 0, ry: 0, rz: 0 }
      }
      window.addEventListener('blur', onBlur)
      const unplug = onSpaceMousePlugged(reconnect)
      unlisten = () => {
        window.removeEventListener('blur', onBlur)
        unplug()
      }
    }
    reconnect()
  }
  return () => {
    entry.motion.remove()
    const i = attached.indexOf(entry)
    if (i >= 0) attached.splice(i, 1)
    if (driven === camera) driven = null
    if (attached.length === 0) {
      unlisten?.()
      unlisten = null
    }
  }
}
