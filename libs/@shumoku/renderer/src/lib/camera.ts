// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Camera (pan + zoom) for Shumoku's rendered SVG. Not bundled into `<ShumokuRenderer>`: hosts
 * call `attachCamera(svg)` when they want one.
 *
 * One view `{ x, y, z }` in the container's CSS px (see `camera-view.ts`). Inputs only queue what
 * they ask for; one animation frame folds it in and writes the viewport's transform once, and
 * stops when nothing moves. Wheel events are read by `camera-wheel.ts`.
 *
 * Inputs:
 * - Wheel: a mouse wheel zooms at the cursor (eased), a trackpad pans; told apart per burst, and
 *   `wheelBehavior` overrides the guess. Ctrl/⌘ + wheel and pinch always zoom; Alt + wheel does the
 *   other thing; Shift + wheel scrolls sideways.
 * - Safari's pinch (`gesture*` events).
 * - Drag: middle button, Alt + left, Space + left, and plain left when `leftDrag: 'pan'`.
 *
 * The pointer-downs the camera takes are stopped in the capture phase on the svg, and so is the
 * click after a pan, so a host listening on an ancestor (the renderer's selection and marquee)
 * never sees them.
 */

import {
  centreOn,
  type Frame,
  fitView,
  fromTransform,
  isUsable,
  keepInView,
  toTransform,
  type View,
  zoomAround,
} from './camera-view.js'
import {
  classify,
  initialClassifier,
  normalizeWheel,
  type WheelBehavior,
  type WheelRates,
  wheelIntent,
} from './camera-wheel.js'

export type { WheelBehavior } from './camera-wheel.js'

export type PanFilter = (event: PointerEvent | MouseEvent) => boolean

export interface CameraOptions {
  /**
   * Zoom bounds `[min, max]`, relative to the fitted drawing (1 = fit). When omitted, `min` is
   * 0.2 and `max` is adaptive: derived from the content/viewport ratio (floored at 10), so a graph
   * far larger than the screen can still be zoomed in until nodes are readable.
   */
  scaleExtent?: [number, number]
  /**
   * Pointer-downs that start a pan. Default: the middle button, or Alt + left. Space + left always
   * pans, and plain left does too with `leftDrag: 'pan'`.
   */
  panFilter?: PanFilter
  /** Zoom per px of a wheel notch, as a factor. Default 1.0018: a 100 px notch zooms ×1.2. */
  wheelZoomSensitivity?: number
  /** Zoom per px of a trackpad pinch, as a factor. Default 1.01. */
  pinchZoomSensitivity?: number
  /**
   * What a plain wheel does: `auto` tells a mouse wheel (zoom) from a trackpad (pan) per burst;
   * `zoom` and `pan` fix it, for devices the guess gets wrong. Default `auto`.
   */
  wheelBehavior?: WheelBehavior
  /**
   * What a plain left drag does: `pan` (a viewer), or `none` to leave it to the host (an editor's
   * marquee and element drag). Default `none`. A drag under 4 px stays a click.
   */
  leftDrag?: 'pan' | 'none'
}

export interface Camera {
  /** The current transform applied to the viewport, in the viewBox's units (`k = 1` is fit). */
  getTransform(): { x: number; y: number; k: number }
  /** Scale by a factor about the centre, eased. */
  zoomBy(factor: number): void
  /** Set the absolute scale (relative to fit), optionally about a point in the viewBox's units. */
  zoomTo(scale: number, point?: [number, number]): void
  /** Set the absolute translation (viewBox units). */
  panTo(x: number, y: number): void
  /** Set translation and scale together, as `getTransform` read them. */
  setTransform(t: { x: number; y: number; k: number }): void
  /**
   * Pan + zoom so a node with `data-id=nodeId` fills roughly `areaRatio` of the drawing's area
   * (default 5%). Returns true if the node was found.
   */
  panToNode(nodeId: string, areaRatio?: number): boolean
  /** Change what a plain wheel does, without re-attaching. */
  setWheelBehavior(behavior: WheelBehavior): void
  /** Change what a plain left drag does (e.g. as a host switches between view and edit). */
  setLeftDrag(leftDrag: 'pan' | 'none'): void
  /** Fit the whole drawing, and keep it fitted as the drawing or the container change. */
  reset(): void
  /** Detach all listeners. Safe to call multiple times. */
  detach(): void
}

const DEFAULT_PAN_FILTER: PanFilter = (e) =>
  ('button' in e && e.button === 1) || ('altKey' in e && e.altKey === true)

/**
 * How far past 1:1 (natural pixel size) the adaptive max zoom allows. 1.5 lets
 * you push a node to ~1.5× its natural size before hitting the cap.
 */
const ADAPTIVE_OVERZOOM = 1.5

/** A drag shorter than this is a click. */
const DRAG_THRESHOLD = 4
/** How long the last input lingers as a gesture (the `camera-gesture` class). */
const SETTLE_MS = 150
/** Time constant of the eased wheel zoom. */
const ZOOM_EASE_MS = 60

/**
 * Derive the max zoom from how much larger the content (viewBox) is than the
 * viewport. At `k = viewBox/viewport`, 1 user unit ≈ 1 CSS px (content at
 * natural size); `overzoom` lets you go a bit past that. `fixedMax` is the
 * floor, so a graph SMALLER than the viewport keeps its normal zoom-in. Returns
 * `fixedMax` when there's nothing to derive from yet (pre-layout / unmeasured).
 *
 * Pure (no DOM) so it's unit-testable; the camera feeds it live measurements.
 */
export function deriveMaxScale(
  viewBoxW: number,
  viewBoxH: number,
  clientW: number,
  clientH: number,
  fixedMax: number,
  overzoom = ADAPTIVE_OVERZOOM,
): number {
  if (
    [viewBoxW, viewBoxH, clientW, clientH].some((value) => !Number.isFinite(value) || value <= 0)
  ) {
    return fixedMax
  }
  const naturalK = Math.max(viewBoxW / clientW, viewBoxH / clientH)
  const maxScale = Math.max(fixedMax, naturalK * overzoom)
  return Number.isFinite(maxScale) ? maxScale : fixedMax
}

/** Whether keys typed here belong to a text field rather than to the canvas. */
function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  )
}

/** Safari's pinch: `GestureEvent` is not in the DOM typings. */
interface GestureLike extends UIEvent {
  scale: number
  clientX: number
  clientY: number
}

const isGesture = (e: Event): e is GestureLike => 'scale' in e && typeof e.scale === 'number'

/**
 * Attach a pan+zoom camera to an svg with a `<g class="viewport">` child.
 * Returns a handle with imperative controls + a `detach()` cleanup.
 */
export function attachCamera(svg: SVGSVGElement, options: CameraOptions = {}): Camera {
  const viewportEl = svg.querySelector<SVGGElement>('.viewport')
  if (!viewportEl) {
    throw new Error(
      '[attachCamera] no `.viewport` <g> found in svg — ShumokuRenderer always produces one; was this called on the wrong element?',
    )
  }
  const viewport: SVGGElement = viewportEl
  const panFilter = options.panFilter ?? DEFAULT_PAN_FILTER
  let leftDrag = options.leftDrag ?? 'none'
  const rates: WheelRates = {
    wheel: Math.log(options.wheelZoomSensitivity ?? 1.0018),
    pinch: Math.log(options.pinchZoomSensitivity ?? 1.01),
  }
  let wheelBehavior: WheelBehavior = options.wheelBehavior ?? 'auto'
  const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform)

  // =========================================================================
  // State
  // =========================================================================

  const measure = (): Frame => {
    const vb = svg.viewBox.baseVal
    return {
      vbX: vb.x,
      vbY: vb.y,
      vbW: vb.width,
      vbH: vb.height,
      cw: svg.clientWidth,
      ch: svg.clientHeight,
    }
  }

  let frame = measure()
  let view: View = fitView(frame)
  /** Whether the view is the fit and should follow the drawing and the container. */
  let fitted = true

  /** The zoom range in `z`. */
  const limits = (): [number, number] => {
    const s = Math.min(frame.cw / frame.vbW, frame.ch / frame.vbH)
    const lo = options.scaleExtent?.[0] ?? 0.2
    const hi =
      options.scaleExtent?.[1] ?? deriveMaxScale(frame.vbW, frame.vbH, frame.cw, frame.ch, 10)
    return [lo * s, hi * s]
  }

  // The container's place on the page, read at the start of a gesture rather than per event:
  // reading layout right after writing the transform would force a reflow every event.
  let rect: DOMRect | null = null
  const local = (clientX: number, clientY: number): [number, number] => {
    rect ??= svg.getBoundingClientRect()
    return [clientX - rect.left, clientY - rect.top]
  }

  // =========================================================================
  // One frame: fold the queued input in, write once
  // =========================================================================

  let panX = 0
  let panY = 0
  /** Zooms applied at once (pinch, programmatic), each about its own anchor. */
  let zooms: { factor: number; ax: number; ay: number }[] = []
  /** The eased wheel zoom: `ln z` it moves toward, and the screen point that stays still. */
  let ease: { target: number; ax: number; ay: number } | null = null
  let raf: number | null = null
  let lastTick = 0

  const write = () => {
    if (!isUsable(frame)) return
    const t = toTransform(view, frame)
    viewport.setAttribute('transform', `translate(${t.tx},${t.ty}) scale(${t.k})`)
  }

  const tick = (now: number) => {
    raf = null
    const dt = lastTick === 0 ? 16 : Math.min(now - lastTick, 50)
    lastTick = now
    if (!isUsable(frame)) {
      panX = 0
      panY = 0
      zooms = []
      ease = null
      lastTick = 0
      return
    }
    const [lo, hi] = limits()
    let v = view
    if (panX !== 0 || panY !== 0) v = { x: v.x + panX, y: v.y + panY, z: v.z }
    panX = 0
    panY = 0
    for (const z of zooms) v = zoomAround(v, z.factor, z.ax, z.ay, lo, hi)
    zooms = []
    if (ease) {
      const target = Math.min(Math.log(hi), Math.max(Math.log(lo), ease.target))
      const current = Math.log(v.z)
      const next = current + (target - current) * (1 - Math.exp(-dt / ZOOM_EASE_MS))
      const done = Math.abs(target - next) < 0.002
      v = zoomAround(v, Math.exp((done ? target : next) - current), ease.ax, ease.ay, lo, hi)
      if (done) ease = null
    }
    view = keepInView(v, frame)
    write()
    if (ease) {
      gesture()
      request()
    } else {
      lastTick = 0
    }
  }

  const request = () => {
    if (raf === null) raf = requestAnimationFrame(tick)
  }

  // While input moves the view, the svg carries `camera-gesture` so hosts can drop expensive
  // ornaments (shadows, small labels); it is removed once the view has rested `SETTLE_MS`.
  const GESTURE_CLASS = 'camera-gesture'
  let settleTimer: ReturnType<typeof setTimeout> | null = null
  const gesture = () => {
    if (!svg.classList.contains(GESTURE_CLASS)) {
      svg.classList.add(GESTURE_CLASS)
      rect = null
    }
    if (settleTimer !== null) clearTimeout(settleTimer)
    settleTimer = setTimeout(() => {
      settleTimer = null
      svg.classList.remove(GESTURE_CLASS)
    }, SETTLE_MS)
  }

  /** The user moved the view: it no longer follows the fit, and any easing toward it stops. */
  const moved = () => {
    fitted = false
    gesture()
    request()
  }

  const easeZoom = (dln: number, ax: number, ay: number) => {
    const base = ease ? ease.target : Math.log(view.z)
    ease = { target: base + dln, ax, ay }
    moved()
  }

  // =========================================================================
  // Wheel
  // =========================================================================

  let classifier = initialClassifier()
  let pinching = false

  const onWheel = (e: WheelEvent) => {
    e.preventDefault()
    // Safari 17+ may send a pinch both as gesture events and as ctrl-wheel; take one.
    if (pinching) return
    const sample = normalizeWheel(e, window.devicePixelRatio)
    const { kind, state } = classify(sample, classifier, isMac)
    classifier = state
    const intent = wheelIntent(sample, kind, wheelBehavior, rates)
    if (intent.type === 'pan') {
      panX -= intent.dx
      panY -= intent.dy
      moved()
      return
    }
    const [ax, ay] = local(e.clientX, e.clientY)
    if (intent.smooth) {
      easeZoom(intent.dln, ax, ay)
    } else {
      ease = null
      zooms.push({ factor: Math.exp(intent.dln), ax, ay })
      moved()
    }
  }

  let gestureScale = 1
  const onGestureStart = (e: Event) => {
    e.preventDefault()
    pinching = true
    gestureScale = 1
  }
  const onGestureChange = (e: Event) => {
    e.preventDefault()
    if (!isGesture(e) || e.scale <= 0) return
    const [ax, ay] = local(e.clientX, e.clientY)
    ease = null
    zooms.push({ factor: e.scale / gestureScale, ax, ay })
    gestureScale = e.scale
    moved()
  }
  const onGestureEnd = (e: Event) => {
    e.preventDefault()
    pinching = false
  }

  // =========================================================================
  // Drag
  // =========================================================================

  let drag: {
    id: number
    startX: number
    startY: number
    lastX: number
    lastY: number
    active: boolean
  } | null = null
  let suppressClick = false
  let spaceHeld = false
  let pointerOver = false

  // A pointer that is already gone (released, or never real) cannot be captured; the pan then
  // simply follows the events the svg itself receives.
  const capture = (pointerId: number) => {
    try {
      svg.setPointerCapture(pointerId)
    } catch {
      // nothing to capture
    }
  }

  const updateCursor = () => {
    svg.classList.toggle('camera-pan-ready', spaceHeld && pointerOver && drag === null)
    svg.classList.toggle('camera-panning', drag?.active === true)
  }

  const startPan = (e: PointerEvent) => {
    drag = {
      id: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      active: true,
    }
    capture(e.pointerId)
    ease = null
    updateCursor()
  }

  const onPointerDown = (e: PointerEvent) => {
    if (drag !== null) return
    const claimed = (e.button === 0 && spaceHeld) || panFilter(e)
    if (claimed) {
      // Taken here, in the capture phase, so the host's selection and marquee never start.
      e.stopPropagation()
      e.preventDefault()
      startPan(e)
      return
    }
    if (e.button === 0 && leftDrag === 'pan' && e.pointerType !== 'touch') {
      // Maybe a click: becomes a pan only past the threshold, and captures the pointer then (a
      // capture now would retarget the click away from the node under it).
      drag = {
        id: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        lastX: e.clientX,
        lastY: e.clientY,
        active: false,
      }
    }
  }

  const onPointerMove = (e: PointerEvent) => {
    if (drag === null || e.pointerId !== drag.id) return
    if (!drag.active) {
      if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < DRAG_THRESHOLD) return
      drag.active = true
      capture(e.pointerId)
      ease = null
      updateCursor()
    }
    panX += e.clientX - drag.lastX
    panY += e.clientY - drag.lastY
    drag.lastX = e.clientX
    drag.lastY = e.clientY
    moved()
  }

  const onPointerEnd = (e: PointerEvent) => {
    if (drag === null || e.pointerId !== drag.id) return
    const travelled = Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY)
    if (drag.active && travelled >= DRAG_THRESHOLD) suppressClick = true
    drag = null
    updateCursor()
  }

  // The click the browser makes after a pan would change the selection.
  const onClick = (e: MouseEvent) => {
    if (!suppressClick) return
    suppressClick = false
    e.stopPropagation()
    e.preventDefault()
  }

  // Middle button: no Windows autoscroll, no Linux paste.
  const onMouseDown = (e: MouseEvent) => {
    if (e.button === 1) e.preventDefault()
  }
  const onAuxClick = (e: MouseEvent) => {
    if (e.button === 1) e.preventDefault()
  }

  const onPointerEnter = () => {
    pointerOver = true
    updateCursor()
  }
  const onPointerLeave = () => {
    pointerOver = false
    updateCursor()
  }

  const isSpace = (e: KeyboardEvent) => e.code === 'Space' || e.key === ' '
  const onKeyDown = (e: KeyboardEvent) => {
    if (!isSpace(e) || !pointerOver || isEditable(e.target)) return
    e.preventDefault()
    if (!spaceHeld) {
      spaceHeld = true
      updateCursor()
    }
  }
  const onKeyUp = (e: KeyboardEvent) => {
    if (!isSpace(e) || !spaceHeld) return
    spaceHeld = false
    updateCursor()
  }
  const onBlur = () => {
    spaceHeld = false
    pinching = false
    updateCursor()
  }

  // =========================================================================
  // The drawing and the container change
  // =========================================================================

  // An edit redraws with new bounds (a new viewBox) and a panel resizes the container. The view
  // is held in screen terms, so it keeps showing the same place; a fitted view stays fitted.
  const refresh = () => {
    frame = measure()
    rect = null
    if (fitted) view = fitView(frame)
    write()
  }
  const viewBoxObserver = new MutationObserver(refresh)
  viewBoxObserver.observe(svg, { attributes: true, attributeFilter: ['viewBox'] })
  const sizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(refresh) : null
  sizeObserver?.observe(svg)
  const onScroll = () => {
    rect = null
  }

  const listeners = new AbortController()
  const on = <K extends keyof SVGElementEventMap>(
    type: K,
    fn: (e: SVGElementEventMap[K]) => void,
    opts: AddEventListenerOptions = {},
  ) => svg.addEventListener(type, fn, { ...opts, signal: listeners.signal })
  on('wheel', onWheel, { passive: false })
  on('pointerdown', onPointerDown, { capture: true })
  on('pointermove', onPointerMove)
  on('pointerup', onPointerEnd)
  on('pointercancel', onPointerEnd)
  on('click', onClick, { capture: true })
  on('mousedown', onMouseDown, { capture: true })
  on('auxclick', onAuxClick, { capture: true })
  on('pointerenter', onPointerEnter)
  on('pointerleave', onPointerLeave)
  for (const [type, fn] of [
    ['gesturestart', onGestureStart],
    ['gesturechange', onGestureChange],
    ['gestureend', onGestureEnd],
  ] as const) {
    svg.addEventListener(type, fn, { passive: false, signal: listeners.signal })
  }
  window.addEventListener('keydown', onKeyDown, { signal: listeners.signal })
  window.addEventListener('keyup', onKeyUp, { signal: listeners.signal })
  window.addEventListener('blur', onBlur, { signal: listeners.signal })
  window.addEventListener('scroll', onScroll, {
    capture: true,
    passive: true,
    signal: listeners.signal,
  })

  write()

  // =========================================================================
  // Handle
  // =========================================================================

  /** Set the view at once, from a programmatic call. */
  const jump = (next: View) => {
    ease = null
    zooms = []
    panX = 0
    panY = 0
    fitted = false
    view = next
    write()
  }

  return {
    getTransform() {
      const t = toTransform(view, frame)
      return { x: t.tx, y: t.ty, k: t.k }
    },

    zoomBy(factor: number) {
      if (!(factor > 0)) return
      easeZoom(Math.log(factor), frame.cw / 2, frame.ch / 2)
    },

    zoomTo(scale: number, point?: [number, number]) {
      if (!isUsable(frame) || !(scale > 0)) return
      const s = Math.min(frame.cw / frame.vbW, frame.ch / frame.vbH)
      const ox = (frame.cw - frame.vbW * s) / 2
      const oy = (frame.ch - frame.vbH * s) / 2
      // `point` is in the viewBox's units, as d3-zoom took it.
      const [px, py] = point ?? [frame.vbX + frame.vbW / 2, frame.vbY + frame.vbH / 2]
      const ax = (px - frame.vbX) * s + ox
      const ay = (py - frame.vbY) * s + oy
      const [lo, hi] = limits()
      jump(zoomAround(view, (scale * s) / view.z, ax, ay, lo, hi))
    },

    panTo(x: number, y: number) {
      const t = toTransform(view, frame)
      jump(fromTransform({ k: t.k, tx: x, ty: y }, frame))
    },

    setTransform(t: { x: number; y: number; k: number }) {
      jump(fromTransform({ k: t.k, tx: t.x, ty: t.y }, frame))
    },

    panToNode(nodeId: string, areaRatio = 0.05): boolean {
      const node = svg.querySelector<SVGGElement>(`g.node[data-id="${CSS.escape(nodeId)}"]`)
      if (!node || !isUsable(frame)) return false
      const bbox = node.getBBox()
      if (!(bbox.width > 0 && bbox.height > 0)) return false
      const s = Math.min(frame.cw / frame.vbW, frame.ch / frame.vbH)
      const [lo, hi] = limits()
      const k = Math.sqrt((frame.vbW * frame.vbH * areaRatio) / (bbox.width * bbox.height))
      jump(centreOn(bbox, Math.min(hi, Math.max(lo, k * s)), frame))
      return true
    },

    setWheelBehavior(behavior: WheelBehavior) {
      wheelBehavior = behavior
    },

    setLeftDrag(next: 'pan' | 'none') {
      leftDrag = next
    },

    reset() {
      jump(fitView(frame))
      fitted = true
    },

    detach() {
      if (raf !== null) cancelAnimationFrame(raf)
      raf = null
      if (settleTimer !== null) clearTimeout(settleTimer)
      settleTimer = null
      listeners.abort()
      viewBoxObserver.disconnect()
      sizeObserver?.disconnect()
      svg.classList.remove(GESTURE_CLASS, 'camera-pan-ready', 'camera-panning')
      viewport.removeAttribute('transform')
    },
  }
}
