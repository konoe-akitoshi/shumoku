/**
 * Zoom-based Hierarchical Navigation
 * Implements map-like zoom transitions between network diagram sheets
 *
 * Design principles:
 * - Spatial UI: Network diagrams are navigated as a spatial system, zoom is natural
 * - 80% mid-transition switch: Sheet switches at 80% of animation to reduce visual discontinuity
 * - Hysteresis: Different thresholds for zoom-in vs zoom-out to prevent oscillation
 */

// ============================================
// Types
// ============================================

export interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

export interface SheetViewBox {
  x: number
  y: number
  w: number
  h: number
  origX: number
  origY: number
  origW: number
  origH: number
}

export interface ZoomNavigationTarget {
  sheetId: string
  bounds: Bounds
  element: Element
}

export interface ZoomNavigationOptions {
  container: HTMLElement
  getCurrentSheetId: () => string
  getSheetViewBox: (sheetId: string) => SheetViewBox | undefined
  updateViewBox: () => void
  initSheet: (sheetId: string) => void
  navigateToSheet: (sheetId: string) => void
  getSheetParentId: (sheetId: string) => string | undefined
}

// ============================================
// State
// ============================================

interface ZoomNavState {
  isAnimating: boolean
  animationId: number | null
  lastZoomDirection: 'in' | 'out' | null
}

const state: ZoomNavState = {
  isAnimating: false,
  animationId: null,
  lastZoomDirection: null,
}

// ============================================
// Constants
// ============================================

// Thresholds with hysteresis to prevent oscillation
const ZOOM_IN_SCALE_THRESHOLD = 1.5 // Scale must be >= this to trigger zoom-in transition
const ZOOM_OUT_SCALE_THRESHOLD = 0.3 // Scale must be <= this to trigger zoom-out (return to parent)
const ANIMATION_DURATION = 450 // ms
const SHEET_SWITCH_PROGRESS = 0.8 // Switch sheet at 80% of animation

// ============================================
// Animation Utilities
// ============================================

/**
 * Easing function: easeOutCubic for smooth deceleration
 */
function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3
}

/**
 * Linear interpolation
 */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/**
 * Interpolate between two viewBox states
 */
function lerpViewBox(
  from: { x: number; y: number; w: number; h: number },
  to: { x: number; y: number; w: number; h: number },
  t: number,
): { x: number; y: number; w: number; h: number } {
  return {
    x: lerp(from.x, to.x, t),
    y: lerp(from.y, to.y, t),
    w: lerp(from.w, to.w, t),
    h: lerp(from.h, to.h, t),
  }
}

// ============================================
// Navigation Detection
// ============================================

/**
 * Find subgraph target under the given client coordinates
 * Uses elementsFromPoint to detect subgraphs even when nodes/links are on top
 */
export function pickSubgraphTarget(
  _container: HTMLElement,
  clientX: number,
  clientY: number,
): ZoomNavigationTarget | null {
  const elements = document.elementsFromPoint(clientX, clientY)

  let subgraph: Element | null = null
  for (const el of elements) {
    const sg = el.closest('.subgraph[data-has-sheet]')
    if (sg) {
      subgraph = sg
      break
    }
  }

  if (!subgraph) return null

  const sheetId = subgraph.getAttribute('data-sheet-id')
  const boundsStr = subgraph.getAttribute('data-bounds')

  if (!sheetId || !boundsStr) return null

  try {
    const bounds = JSON.parse(boundsStr.replace(/&quot;/g, '"')) as Bounds
    return { sheetId, bounds, element: subgraph }
  } catch {
    return null
  }
}

/**
 * Calculate the current zoom scale relative to original viewBox
 */
export function calculateScale(vb: SheetViewBox): number {
  return vb.origW / vb.w
}

/**
 * Check if viewBox is close enough to bounds to trigger transition
 * Considers: area ratio, center proximity, and scale
 */
export function shouldTriggerZoomIn(vb: SheetViewBox, bounds: Bounds, scale: number): boolean {
  // 1. Check scale threshold with hysteresis
  if (scale < ZOOM_IN_SCALE_THRESHOLD) return false

  // 2. Check if viewBox area is close to bounds area
  const viewBoxArea = vb.w * vb.h
  const boundsArea = bounds.width * bounds.height
  const areaRatio = viewBoxArea / boundsArea
  // ViewBox should be at most 2x the bounds area
  if (areaRatio > 2.0) return false

  // 3. Check if viewBox center is within or near the bounds
  const vbCenterX = vb.x + vb.w / 2
  const vbCenterY = vb.y + vb.h / 2
  const boundsCenterX = bounds.x + bounds.width / 2
  const boundsCenterY = bounds.y + bounds.height / 2

  const centerDist = Math.hypot(vbCenterX - boundsCenterX, vbCenterY - boundsCenterY)
  // Allow center to be within 70% of the bounds diagonal
  const maxDist = Math.hypot(bounds.width, bounds.height) * 0.7

  return centerDist <= maxDist
}

/**
 * Check if should return to parent sheet (zoomed out enough)
 */
export function shouldTriggerZoomOut(vb: SheetViewBox, scale: number, sheetId: string): boolean {
  // Never auto-return from root sheet
  if (sheetId === 'root') return false

  // Check scale threshold
  if (scale > ZOOM_OUT_SCALE_THRESHOLD) return false

  // Check coverage - viewBox should encompass more than the original content
  const viewBoxArea = vb.w * vb.h
  const originalArea = vb.origW * vb.origH
  const coverage = originalArea / viewBoxArea

  // If original content is less than 50% of viewBox, user has zoomed out a lot
  return coverage < 0.5
}

// ============================================
// Animation Functions
// ============================================

/**
 * Animate zoom to target bounds
 */
export function animateZoomToBounds(
  vb: SheetViewBox,
  targetBounds: Bounds,
  onUpdate: (newVb: { x: number; y: number; w: number; h: number }) => void,
  onSheetSwitch: () => void,
  onComplete: () => void,
): void {
  if (state.isAnimating) return

  state.isAnimating = true
  state.lastZoomDirection = 'in'

  const startTime = performance.now()
  const from = { x: vb.x, y: vb.y, w: vb.w, h: vb.h }

  // Target: fit bounds into viewBox with some padding
  const padding = 0.1 // 10% padding
  const to = {
    x: targetBounds.x - targetBounds.width * padding,
    y: targetBounds.y - targetBounds.height * padding,
    w: targetBounds.width * (1 + padding * 2),
    h: targetBounds.height * (1 + padding * 2),
  }

  let sheetSwitched = false

  function animate() {
    const elapsed = performance.now() - startTime
    const rawProgress = Math.min(elapsed / ANIMATION_DURATION, 1)
    const easedProgress = easeOutCubic(rawProgress)

    const current = lerpViewBox(from, to, easedProgress)
    onUpdate(current)

    // Switch sheet at 80% progress
    if (!sheetSwitched && rawProgress >= SHEET_SWITCH_PROGRESS) {
      sheetSwitched = true
      onSheetSwitch()
    }

    if (rawProgress < 1) {
      state.animationId = requestAnimationFrame(animate)
    } else {
      state.isAnimating = false
      state.animationId = null
      onComplete()
    }
  }

  state.animationId = requestAnimationFrame(animate)
}

/**
 * Animate zoom out to return to parent
 */
export function animateZoomOut(
  vb: SheetViewBox,
  onUpdate: (newVb: { x: number; y: number; w: number; h: number }) => void,
  onSheetSwitch: () => void,
  onComplete: () => void,
): void {
  if (state.isAnimating) return

  state.isAnimating = true
  state.lastZoomDirection = 'out'

  const startTime = performance.now()
  const from = { x: vb.x, y: vb.y, w: vb.w, h: vb.h }

  // Target: original viewBox (full sheet view)
  const to = {
    x: vb.origX,
    y: vb.origY,
    w: vb.origW,
    h: vb.origH,
  }

  let sheetSwitched = false

  function animate() {
    const elapsed = performance.now() - startTime
    const rawProgress = Math.min(elapsed / ANIMATION_DURATION, 1)
    const easedProgress = easeOutCubic(rawProgress)

    const current = lerpViewBox(from, to, easedProgress)
    onUpdate(current)

    // Switch sheet at 80% progress
    if (!sheetSwitched && rawProgress >= SHEET_SWITCH_PROGRESS) {
      sheetSwitched = true
      onSheetSwitch()
    }

    if (rawProgress < 1) {
      state.animationId = requestAnimationFrame(animate)
    } else {
      state.isAnimating = false
      state.animationId = null
      onComplete()
    }
  }

  state.animationId = requestAnimationFrame(animate)
}

/**
 * Cancel any running animation
 */
export function cancelAnimation(): void {
  if (state.animationId !== null) {
    cancelAnimationFrame(state.animationId)
    state.animationId = null
  }
  state.isAnimating = false
}

/**
 * Check if animation is currently running
 */
export function isAnimating(): boolean {
  return state.isAnimating
}

// ============================================
// Coordinate Bridging
// ============================================

/**
 * Initialize child sheet viewBox for smooth transition from parent
 * Sets the child sheet to fit view on entry
 */
export function initChildViewBox(
  sheetViewBoxes: Record<string, SheetViewBox>,
  sheetId: string,
  containerWidth: number,
  containerHeight: number,
): void {
  const child = sheetViewBoxes[sheetId]
  if (!child) return

  // Fit child sheet to container with 90% scale
  const scale = Math.min(containerWidth / child.origW, containerHeight / child.origH) * 0.9
  child.w = containerWidth / scale
  child.h = containerHeight / scale
  child.x = child.origX + (child.origW - child.w) / 2
  child.y = child.origY + (child.origH - child.h) / 2
}

/**
 * Position parent viewBox to show where we came back from
 * Centers on the subgraph bounds we navigated from
 */
export function positionParentViewBox(
  parentVb: SheetViewBox,
  childBounds: Bounds,
  containerWidth: number,
  containerHeight: number,
): void {
  // Calculate appropriate zoom level to show context around the child bounds
  const padding = 2 // Show area 2x the child bounds size for context
  const targetW = childBounds.width * padding
  const targetH = childBounds.height * padding

  // Maintain aspect ratio
  const aspectRatio = containerWidth / containerHeight
  const boundsAspect = targetW / targetH

  let w: number, h: number
  if (boundsAspect > aspectRatio) {
    w = targetW
    h = targetW / aspectRatio
  } else {
    h = targetH
    w = targetH * aspectRatio
  }

  // Center on child bounds
  parentVb.x = childBounds.x + childBounds.width / 2 - w / 2
  parentVb.y = childBounds.y + childBounds.height / 2 - h / 2
  parentVb.w = w
  parentVb.h = h
}

// ============================================
// Main Setup Function
// ============================================

/**
 * Setup zoom-based hierarchical navigation
 * Returns cleanup function
 */
export function setupZoomNavigation(opts: ZoomNavigationOptions): () => void {
  let pendingTarget: ZoomNavigationTarget | null = null

  const checkZoomInTransition = (clientX: number, clientY: number) => {
    if (state.isAnimating) return

    const currentSheetId = opts.getCurrentSheetId()
    const vb = opts.getSheetViewBox(currentSheetId)
    if (!vb) return

    const scale = calculateScale(vb)
    const target = pickSubgraphTarget(opts.container, clientX, clientY)

    if (target && shouldTriggerZoomIn(vb, target.bounds, scale)) {
      pendingTarget = target

      animateZoomToBounds(
        vb,
        target.bounds,
        (newVb) => {
          vb.x = newVb.x
          vb.y = newVb.y
          vb.w = newVb.w
          vb.h = newVb.h
          opts.updateViewBox()
        },
        () => {
          // Sheet switch at 80%
          if (pendingTarget) {
            opts.initSheet(pendingTarget.sheetId)
            initChildViewBox(
              { [pendingTarget.sheetId]: opts.getSheetViewBox(pendingTarget.sheetId)! },
              pendingTarget.sheetId,
              opts.container.clientWidth,
              opts.container.clientHeight,
            )
            opts.navigateToSheet(pendingTarget.sheetId)
          }
        },
        () => {
          pendingTarget = null
        },
      )
    }
  }

  const checkZoomOutTransition = () => {
    if (state.isAnimating) return

    const currentSheetId = opts.getCurrentSheetId()
    const vb = opts.getSheetViewBox(currentSheetId)
    if (!vb) return

    const scale = calculateScale(vb)
    const parentId = opts.getSheetParentId(currentSheetId)

    if (parentId && shouldTriggerZoomOut(vb, scale, currentSheetId)) {
      animateZoomOut(
        vb,
        (newVb) => {
          vb.x = newVb.x
          vb.y = newVb.y
          vb.w = newVb.w
          vb.h = newVb.h
          opts.updateViewBox()
        },
        () => {
          // Sheet switch at 80%
          opts.navigateToSheet(parentId)
        },
        () => {
          // Animation complete
        },
      )
    }
  }

  // Store last wheel position for transition check
  let lastWheelX = 0
  let lastWheelY = 0

  const handleWheelEnd = () => {
    // Check transitions after wheel stops
    const currentSheetId = opts.getCurrentSheetId()
    const vb = opts.getSheetViewBox(currentSheetId)
    if (!vb) return

    const scale = calculateScale(vb)

    if (scale >= ZOOM_IN_SCALE_THRESHOLD) {
      checkZoomInTransition(lastWheelX, lastWheelY)
    } else if (scale <= ZOOM_OUT_SCALE_THRESHOLD) {
      checkZoomOutTransition()
    }
  }

  // Debounce wheel end detection
  let wheelEndTimeout: ReturnType<typeof setTimeout> | null = null

  const onWheel = (e: WheelEvent) => {
    lastWheelX = e.clientX
    lastWheelY = e.clientY

    if (wheelEndTimeout) {
      clearTimeout(wheelEndTimeout)
    }

    wheelEndTimeout = setTimeout(handleWheelEnd, 150)
  }

  opts.container.addEventListener('wheel', onWheel, { passive: true })

  // Cleanup function
  return () => {
    opts.container.removeEventListener('wheel', onWheel)
    if (wheelEndTimeout) {
      clearTimeout(wheelEndTimeout)
    }
    cancelAnimation()
  }
}

/**
 * Generate inline JavaScript for hierarchical HTML pages
 * This code runs in the browser without module imports
 */
export function getZoomNavigationScript(): string {
  return `
// Zoom Navigation State
var zoomNavState = {
  isAnimating: false,
  animationId: null
};

var ZOOM_IN_SCALE_THRESHOLD = 1.5;
var ZOOM_OUT_SCALE_THRESHOLD = 0.3;
var ANIMATION_DURATION = 450;
var SHEET_SWITCH_PROGRESS = 0.8;

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpViewBox(from, to, t) {
  return {
    x: lerp(from.x, to.x, t),
    y: lerp(from.y, to.y, t),
    w: lerp(from.w, to.w, t),
    h: lerp(from.h, to.h, t)
  };
}

function pickSubgraphTarget(clientX, clientY) {
  // Use elementsFromPoint to find subgraphs even when nodes/links are on top
  var elements = document.elementsFromPoint(clientX, clientY);
  var subgraph = null;

  for (var i = 0; i < elements.length; i++) {
    var el = elements[i];
    var sg = el.closest ? el.closest('.subgraph[data-has-sheet]') : null;
    if (sg) {
      subgraph = sg;
      break;
    }
  }

  if (!subgraph) return null;

  var sheetId = subgraph.getAttribute('data-sheet-id');
  var boundsStr = subgraph.getAttribute('data-bounds');

  if (!sheetId || !boundsStr) return null;

  try {
    var bounds = JSON.parse(boundsStr.replace(/&quot;/g, '"'));
    return { sheetId: sheetId, bounds: bounds, element: subgraph };
  } catch (e) {
    return null;
  }
}

function calculateScale(vb) {
  return vb.origW / vb.w;
}

function shouldTriggerZoomIn(vb, bounds, scale) {
  if (scale < ZOOM_IN_SCALE_THRESHOLD) return false;

  var viewBoxArea = vb.w * vb.h;
  var boundsArea = bounds.width * bounds.height;
  var areaRatio = viewBoxArea / boundsArea;
  // viewBox should be at most 2x the bounds area (relaxed from 1.5)
  if (areaRatio > 2.0) return false;

  // Check if viewBox center is within or near the bounds
  var vbCenterX = vb.x + vb.w / 2;
  var vbCenterY = vb.y + vb.h / 2;
  var boundsCenterX = bounds.x + bounds.width / 2;
  var boundsCenterY = bounds.y + bounds.height / 2;

  var centerDist = Math.hypot(vbCenterX - boundsCenterX, vbCenterY - boundsCenterY);
  // Relaxed: allow center to be within 70% of the bounds diagonal
  var maxDist = Math.hypot(bounds.width, bounds.height) * 0.7;

  return centerDist <= maxDist;
}

function shouldTriggerZoomOut(vb, scale, sheetId) {
  if (sheetId === 'root') return false;
  if (scale > ZOOM_OUT_SCALE_THRESHOLD) return false;

  var viewBoxArea = vb.w * vb.h;
  var originalArea = vb.origW * vb.origH;
  var coverage = originalArea / viewBoxArea;

  return coverage < 0.5;
}

function animateZoomToBounds(vb, targetBounds, onUpdate, onSheetSwitch, onComplete) {
  if (zoomNavState.isAnimating) return;

  zoomNavState.isAnimating = true;

  var startTime = performance.now();
  var from = { x: vb.x, y: vb.y, w: vb.w, h: vb.h };

  var padding = 0.1;
  var to = {
    x: targetBounds.x - targetBounds.width * padding,
    y: targetBounds.y - targetBounds.height * padding,
    w: targetBounds.width * (1 + padding * 2),
    h: targetBounds.height * (1 + padding * 2)
  };

  var sheetSwitched = false;

  function animate() {
    var elapsed = performance.now() - startTime;
    var rawProgress = Math.min(elapsed / ANIMATION_DURATION, 1);
    var easedProgress = easeOutCubic(rawProgress);

    var current = lerpViewBox(from, to, easedProgress);
    onUpdate(current);

    if (!sheetSwitched && rawProgress >= SHEET_SWITCH_PROGRESS) {
      sheetSwitched = true;
      onSheetSwitch();
    }

    if (rawProgress < 1) {
      zoomNavState.animationId = requestAnimationFrame(animate);
    } else {
      zoomNavState.isAnimating = false;
      zoomNavState.animationId = null;
      onComplete();
    }
  }

  zoomNavState.animationId = requestAnimationFrame(animate);
}

function animateZoomOut(vb, onUpdate, onSheetSwitch, onComplete) {
  if (zoomNavState.isAnimating) return;

  zoomNavState.isAnimating = true;

  var startTime = performance.now();
  var from = { x: vb.x, y: vb.y, w: vb.w, h: vb.h };
  var to = { x: vb.origX, y: vb.origY, w: vb.origW, h: vb.origH };

  var sheetSwitched = false;

  function animate() {
    var elapsed = performance.now() - startTime;
    var rawProgress = Math.min(elapsed / ANIMATION_DURATION, 1);
    var easedProgress = easeOutCubic(rawProgress);

    var current = lerpViewBox(from, to, easedProgress);
    onUpdate(current);

    if (!sheetSwitched && rawProgress >= SHEET_SWITCH_PROGRESS) {
      sheetSwitched = true;
      onSheetSwitch();
    }

    if (rawProgress < 1) {
      zoomNavState.animationId = requestAnimationFrame(animate);
    } else {
      zoomNavState.isAnimating = false;
      zoomNavState.animationId = null;
      onComplete();
    }
  }

  zoomNavState.animationId = requestAnimationFrame(animate);
}

function initChildViewBox(sheetId, cw, ch) {
  var child = sheetViewBoxes[sheetId];
  if (!child) return;

  var scale = Math.min(cw / child.origW, ch / child.origH) * 0.9;
  child.w = cw / scale;
  child.h = ch / scale;
  child.x = child.origX + (child.origW - child.w) / 2;
  child.y = child.origY + (child.origH - child.h) / 2;
}
`
}
