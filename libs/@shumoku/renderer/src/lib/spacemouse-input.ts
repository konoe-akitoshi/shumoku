// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * The SpaceMouse as a companion to the mouse, for every diagram on the page: the cap pans and
 * zooms, and the buttons run `BINDINGS` (Fit fits; Shift, held, slows the cap down). One device
 * per page; each camera that attaches can be driven, and the one the pointer is over (else the one
 * it was last over, else the last attached) is. Connecting needs a user gesture once
 * (`connectSpaceMouse`); afterwards a granted device is opened when a camera attaches and when it
 * is plugged back in. Chrome keeps the grant only for devices with a serial number: one without
 * (a SpaceExplorer) is picked again after being unplugged.
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
  isDown,
  motionOf,
  onSpaceMousePlugged,
  openSpaceMouse,
  type SpaceMouseButtons,
  type SpaceMouseConnection,
  type SpaceMouseSettings,
  type SpaceMouseState,
  type SpaceMouseStatus,
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
  const s = defaultSpaceMouseSettings()
  const invert = stored('shumoku.spacemouse.invert').split(',')
  s.invertX = invert.includes('x')
  s.invertY = invert.includes('y')
  s.invertZ = invert.includes('z')
  const speed = Number.parseFloat(stored('shumoku.spacemouse.speed'))
  if (speed > 0) {
    s.panSpeed *= speed
    s.zoomSpeed *= speed
  }
  return s
}

/** What each named button does: a command on press, or `precise` while held. */
type Binding = 'fit' | 'zoomIn' | 'zoomOut' | 'precise'
const BINDINGS: Readonly<Record<string, Binding>> = { fit: 'fit', shift: 'precise' }

const pressCommands: Record<Exclude<Binding, 'precise'>, (c: Camera) => void> = {
  fit: (c) => c.reset(),
  zoomIn: (c) => c.zoomBy(1.25),
  zoomOut: (c) => c.zoomBy(0.8),
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

let settings: SpaceMouseSettings | null = null
let debug = false
let connection: SpaceMouseConnection | null = null
/** The one open in flight: a reconnect and a click must not open the device twice. */
let opening: Promise<string | null> | null = null
/** The connected model's buttons. */
let buttons: SpaceMouseButtons = {}
let state: SpaceMouseState | null = null
const attached: Attached[] = []
/** The camera driven last (the pointer was over it, or it was the only choice). */
let driven: Camera | null = null
const listeners = new Set<() => void>()
/** Page-wide listeners, set up with the first camera and removed with the last. */
let unlisten: (() => void) | null = null

const notify = () => {
  for (const l of listeners) l()
}

/** The camera to drive now; remembers it, so leaving the diagrams keeps driving it. */
function current(): Camera | null {
  driven = pickCamera(
    attached.map((a) => a.camera),
    driven,
  )
  return driven
}

function sampleFor(camera: Camera) {
  // Read once a frame: no state changes here, only whether this camera is the one driven.
  return () => {
    if (!state || !settings || !document.hasFocus() || driven !== camera) return null
    const held = state.buttons
    const precise = Object.entries(BINDINGS).some(
      ([name, binding]) => binding === 'precise' && isDown(held, buttons, name),
    )
    return motionOf(state, settings, precise)
  }
}

function onState(next: SpaceMouseState, previous: SpaceMouseState) {
  state = next
  if (debug) console.info('[spacemouse]', next)
  // The device follows the window's focus, buttons and cap alike.
  if (!document.hasFocus()) return
  const camera = current()
  const pressed = next.buttons & ~previous.buttons
  for (const [name, binding] of Object.entries(BINDINGS)) {
    if (binding === 'precise' || !camera || !isDown(pressed, buttons, name)) continue
    pressCommands[binding](camera)
  }
  for (const a of attached) a.motion.wake()
}

function describe(status: SpaceMouseStatus): string | null {
  switch (status.kind) {
    case 'unsupported':
      return 'A SpaceMouse needs WebHID: open this page in Chrome or Edge, over HTTPS (or on localhost).'
    case 'blocked':
      return 'This page may not use a SpaceMouse here (it is shown inside another site; the frame needs allow="hid").'
    case 'open-failed':
      return `The SpaceMouse could not be opened (${status.message}). On Linux, add a udev rule giving your user access to its hidraw device (spacenavd can keep running). On Windows / macOS, 3DxWare may be holding it.`
    default:
      return null
  }
}

/** Open the device, once at a time; the message to show the user, if something went wrong. */
function open(request: boolean): Promise<string | null> {
  if (connection) return Promise.resolve(null)
  // A reconnect in flight: wait for it, then pick the device only if it found none.
  if (opening) {
    return opening.then((message) => (connection || !request ? message : open(true)))
  }
  settings ??= readSettings()
  debug = stored('shumoku.spacemouse.debug') === '1'
  let message: string | null = null
  opening = openSpaceMouse({
    request,
    onState,
    onStatus: (status) => {
      if (status.kind === 'disconnected') {
        connection = null
        state = null
        buttons = {}
        notify()
      }
      if (status.kind === 'connected') {
        buttons = status.buttons
        console.info(`[spacemouse] connected: ${status.name}`)
      }
      message = describe(status) ?? message
    },
  })
    .then((opened) => {
      connection = opened
      notify()
      if (message && !request) console.warn(`[spacemouse] ${message}`)
      return request ? message : null
    })
    .finally(() => {
      opening = null
    })
  return opening
}

/**
 * Connect, from a user gesture: asks the user to pick the device the first time. Resolves to a
 * message for the user when it failed (WebHID missing, not HTTPS, the device not openable), else
 * null.
 */
export function connectSpaceMouse(): Promise<string | null> {
  const availability = spaceMouseAvailability()
  if (availability === 'insecure') {
    return Promise.resolve(
      'A SpaceMouse needs this page to be opened over HTTPS (or on localhost): browsers allow WebHID only there.',
    )
  }
  if (availability !== 'ok') {
    return Promise.resolve(describe({ kind: availability }))
  }
  return open(true)
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
      const onBlur = () => {
        if (state) state = { ...state, tx: 0, ty: 0, tz: 0, rx: 0, ry: 0, rz: 0 }
      }
      window.addEventListener('blur', onBlur)
      const unplug = onSpaceMousePlugged(() => void open(false))
      unlisten = () => {
        window.removeEventListener('blur', onBlur)
        unplug()
      }
    }
    void open(false)
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
