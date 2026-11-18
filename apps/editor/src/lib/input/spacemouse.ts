// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import {
  type Camera,
  defaultSpaceMouseSettings,
  isDown,
  type MotionHandle,
  motionOf,
  openSpaceMouse,
  type SpaceMouseButtons,
  type SpaceMouseConnection,
  type SpaceMouseState,
  type SpaceMouseStatus,
  spaceMouseSupported,
} from '@shumoku/renderer'

/**
 * The SpaceMouse as the diagram camera's companion: the cap pans and zooms, and the buttons run
 * the commands in `BINDINGS` (Fit fits; Shift, held, slows the cap down). One device for the whole app; the diagram page hands it its camera while mounted.
 * Connecting needs a user gesture once ("Connect SpaceMouse"); later visits reconnect on their own.
 *
 * Axis directions are not verified on hardware yet. To see raw reports, set
 * `localStorage['shumoku.spacemouse.debug'] = '1'`; to flip an axis, set
 * `localStorage['shumoku.spacemouse.invert'] = 'x,y,z'` (any of them).
 */

const settings = (() => {
  const s = defaultSpaceMouseSettings()
  try {
    const invert = (localStorage.getItem('shumoku.spacemouse.invert') ?? '').split(',')
    s.invertX = invert.includes('x')
    s.invertY = invert.includes('y')
    s.invertZ = invert.includes('z')
  } catch {
    // no storage: defaults
  }
  return s
})()

const debug = () => {
  try {
    return localStorage.getItem('shumoku.spacemouse.debug') === '1'
  } catch {
    return false
  }
}

/** What each named button does: a command on press, or `precise` while held. */
type Binding = 'fit' | 'zoomIn' | 'zoomOut' | 'precise'
const BINDINGS: Readonly<Record<string, Binding>> = { fit: 'fit', shift: 'precise' }

const pressCommands: Record<Exclude<Binding, 'precise'>, (c: Camera) => void> = {
  fit: (c) => c.reset(),
  zoomIn: (c) => c.zoomBy(1.25),
  zoomOut: (c) => c.zoomBy(0.8),
}

let connection: SpaceMouseConnection | null = null
/** The connected model's buttons. */
let buttons: SpaceMouseButtons = {}
let opening: Promise<void> | null = null
let state: SpaceMouseState | null = null
let camera: Camera | null = null
let motion: MotionHandle | null = null

const sample = () => {
  if (!state || !document.hasFocus()) return null
  const held = state.buttons
  const precise = Object.entries(BINDINGS).some(
    ([name, binding]) => binding === 'precise' && isDown(held, buttons, name),
  )
  return motionOf(state, settings, precise)
}

function onState(next: SpaceMouseState, previous: SpaceMouseState) {
  state = next
  if (debug()) console.info('[spacemouse]', next)
  const pressed = next.buttons & ~previous.buttons
  for (const [name, binding] of Object.entries(BINDINGS)) {
    if (binding === 'precise' || !camera || !isDown(pressed, buttons, name)) continue
    pressCommands[binding](camera)
  }
  motion?.wake()
}

function describe(status: SpaceMouseStatus): string | null {
  switch (status.kind) {
    case 'unsupported':
      return 'SpaceMouse needs WebHID: open the editor in Chrome or Edge.'
    case 'open-failed':
      return `The SpaceMouse could not be opened (${status.message}). On Linux, add a udev rule giving your user access to its hidraw device; close other apps using it.`
    default:
      return null
  }
}

async function open(request: boolean): Promise<void> {
  if (connection) return
  connection = await openSpaceMouse({
    request,
    onState,
    onStatus: (status) => {
      if (status.kind === 'disconnected') {
        connection = null
        state = null
        buttons = {}
      }
      if (status.kind === 'connected') {
        buttons = status.buttons
        console.info(
          `[spacemouse] connected: ${status.name}. If moving the cap does nothing, quit 3DxWare (it holds the device).`,
        )
      }
      const message = describe(status)
      if (message && request) window.alert(message)
      else if (message) console.warn(`[spacemouse] ${message}`)
    },
  })
}

/** Connect (from a user gesture): asks the user to pick the device the first time. */
export function connectSpaceMouse(): Promise<void> {
  opening = open(true).finally(() => {
    opening = null
  })
  return opening
}

export const canConnectSpaceMouse = () => spaceMouseSupported()

/** Give the SpaceMouse a camera to drive; returns the detach. Reconnects a granted device. */
export function attachSpaceMouse(target: Camera): () => void {
  camera = target
  motion = target.addMotion(sample)
  if (!connection && !opening && spaceMouseSupported()) void open(false)
  const onBlur = () => {
    if (state) state = { ...state, tx: 0, ty: 0, tz: 0, rx: 0, ry: 0, rz: 0 }
  }
  window.addEventListener('blur', onBlur)
  return () => {
    window.removeEventListener('blur', onBlur)
    motion?.remove()
    motion = null
    if (camera === target) camera = null
  }
}
