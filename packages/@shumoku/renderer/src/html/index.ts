/**
 * HTML Renderer
 * Generates standalone interactive HTML pages from NetworkGraph
 */

import type { HierarchicalNetworkGraph, LayoutResult, NetworkGraph } from '@shumoku/core'
import { BRANDING_ICON_SVG } from '../brand.js'
import { SVGRenderer } from '../svg.js'
import type { HTMLRendererOptions } from '../types.js'
import {
  generateNavigationToolbar,
  getNavigationScript,
  getNavigationStyles,
  type NavigationState,
  type SheetInfo,
} from './navigation.js'
import { getZoomNavigationScript } from './zoom-navigation.js'

export type { InteractiveInstance, InteractiveOptions } from '../types.js'
// Re-export navigation types
export type { NavigationState, SheetInfo } from './navigation.js'
// Re-export runtime for direct usage
export { initInteractive } from './runtime.js'

// IIFE content - will be set by consumer
let INTERACTIVE_IIFE = ''

/**
 * Set the IIFE content for standalone HTML pages
 */
export function setIIFE(iife: string): void {
  INTERACTIVE_IIFE = iife
}

/**
 * Get the current IIFE content
 */
export function getIIFE(): string {
  return INTERACTIVE_IIFE
}

export interface RenderOptions extends HTMLRendererOptions {
  /**
   * Enable hierarchical navigation UI
   */
  hierarchical?: boolean

  /**
   * Current sheet ID for hierarchical rendering
   */
  currentSheet?: string

  /**
   * Navigation state for hierarchical diagrams
   */
  navigation?: NavigationState

  /**
   * Pre-resolved icon dimensions for proper aspect ratio rendering
   */
  iconDimensions?: Map<string, { width: number; height: number }>
}

const DEFAULT_OPTIONS = {
  branding: true,
  toolbar: true,
  hierarchical: false,
}

/**
 * Render a complete standalone HTML page from NetworkGraph
 */
export function render(graph: NetworkGraph, layout: LayoutResult, options?: RenderOptions): string {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  // Auto-detect hierarchical mode if not explicitly set
  if (options?.hierarchical === undefined) {
    opts.hierarchical = hasHierarchicalContent(graph)
  }

  const svgRenderer = new SVGRenderer({
    renderMode: 'interactive',
    iconDimensions: options?.iconDimensions,
  })
  const svg = svgRenderer.render(graph, layout)
  const title = options?.title || graph.name || 'Network Diagram'

  // Build navigation state if hierarchical
  let navigation: NavigationState | undefined = options?.navigation
  if (!navigation && opts.hierarchical && isHierarchicalGraph(graph)) {
    navigation = buildNavigationState(graph as HierarchicalNetworkGraph, opts.currentSheet)
  }

  return generateHtml(svg, title, { ...opts, navigation } as Required<RenderOptions>)
}

/**
 * Sheet data for hierarchical rendering
 */
export interface SheetData {
  graph: NetworkGraph
  layout: LayoutResult
}

/**
 * Render a hierarchical HTML page with multiple embedded sheets
 */
export function renderHierarchical(
  sheets: Map<string, SheetData>,
  options?: RenderOptions,
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options, hierarchical: true }

  const sheetSvgs = new Map<string, string>()
  const sheetInfos = new Map<string, SheetInfo>()
  const rootSheet = sheets.get('root')

  // Render child sheets for navigation (detail view when clicking subgraphs)
  for (const [sheetId, data] of sheets) {
    if (sheetId === 'root') continue // Skip root for now

    // Render child sheet
    const svgRenderer = new SVGRenderer({
      renderMode: 'interactive',
      sheetId,
      iconDimensions: options?.iconDimensions,
    })
    const svg = svgRenderer.render(data.graph, data.layout)
    sheetSvgs.set(sheetId, svg)
    sheetInfos.set(sheetId, {
      id: sheetId,
      label: data.graph.name || sheetId,
      parentId: 'root',
    })
  }

  // Render root sheet (ELK handles hierarchical layout natively, no embedding needed)
  if (rootSheet) {
    const rootRenderer = new SVGRenderer({
      renderMode: 'interactive',
      sheetId: 'root',
      iconDimensions: options?.iconDimensions,
    })
    const rootSvg = rootRenderer.render(rootSheet.graph, rootSheet.layout)
    sheetSvgs.set('root', rootSvg)
    sheetInfos.set('root', {
      id: 'root',
      label: rootSheet.graph.name || 'root',
      parentId: undefined,
    })
  }

  // Get title from root sheet
  const title = options?.title || rootSheet?.graph.name || 'Network Diagram'

  // Build navigation state
  const navigation: NavigationState = {
    currentSheet: 'root',
    breadcrumb: ['root'],
    sheets: sheetInfos,
  }

  return generateHierarchicalHtml(sheetSvgs, title, {
    ...opts,
    navigation,
  } as Required<RenderOptions>)
}

/**
 * Check if graph is a hierarchical graph
 */
function isHierarchicalGraph(graph: NetworkGraph): graph is HierarchicalNetworkGraph {
  return 'sheets' in graph || 'breadcrumb' in graph
}

/**
 * Check if graph has hierarchical content (subgraphs with file/pins)
 */
function hasHierarchicalContent(graph: NetworkGraph): boolean {
  if (isHierarchicalGraph(graph)) return true
  if (!graph.subgraphs) return false
  return graph.subgraphs.some((sg) => sg.file || (sg.pins && sg.pins.length > 0))
}

/**
 * Build navigation state from hierarchical graph
 */
function buildNavigationState(
  graph: HierarchicalNetworkGraph,
  currentSheet?: string,
): NavigationState {
  const sheets = new Map<string, SheetInfo>()

  // Add root
  sheets.set('root', {
    id: 'root',
    label: graph.name || 'Overview',
  })

  // Add sheets from subgraphs
  if (graph.subgraphs) {
    for (const subgraph of graph.subgraphs) {
      if (subgraph.file) {
        sheets.set(subgraph.id, {
          id: subgraph.id,
          label: subgraph.label,
          parentId: 'root',
        })
      }
    }
  }

  // Add nested sheets
  if (graph.sheets) {
    for (const [id, sheet] of graph.sheets) {
      if (!sheets.has(id)) {
        sheets.set(id, {
          id,
          label: sheet.name || id,
          parentId: graph.parentSheet,
        })
      }
    }
  }

  // Build breadcrumb
  const breadcrumb = graph.breadcrumb || ['root']
  if (currentSheet && !breadcrumb.includes(currentSheet)) {
    breadcrumb.push(currentSheet)
  }

  return {
    currentSheet,
    breadcrumb,
    sheets,
  }
}

function generateHtml(svg: string, title: string, options: Required<RenderOptions>): string {
  const brandingHtml = options.branding
    ? `<a class="branding" href="https://shumoku.packof.me" target="_blank" rel="noopener">
      ${BRANDING_ICON_SVG}
      <span>Made with Shumoku</span>
    </a>`
    : ''

  const toolbarHtml = options.toolbar
    ? `<div class="toolbar">
    <span class="toolbar-title">${escapeHtml(title)}</span>
    <div class="toolbar-buttons">
      <button id="btn-out" title="Zoom Out"><svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-width="2" d="M20 12H4"/></svg></button>
      <span class="zoom-text" id="zoom">100%</span>
      <button id="btn-in" title="Zoom In"><svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg></button>
      <button id="btn-fit" title="Fit"><svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/></svg></button>
      <button id="btn-reset" title="Reset"><svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg></button>
    </div>
  </div>`
    : ''

  // Navigation toolbar for hierarchical diagrams
  const navToolbarHtml =
    options.hierarchical && options.navigation ? generateNavigationToolbar(options.navigation) : ''

  // Navigation styles
  const navStyles = options.hierarchical ? getNavigationStyles() : ''

  // Navigation scripts
  const navScript = options.hierarchical ? getNavigationScript() : ''

  // Calculate container height based on toolbar presence
  const headerHeight = options.toolbar ? 45 : 0
  const navHeight = options.hierarchical && options.navigation ? 60 : 0
  const totalHeaderHeight = headerHeight + navHeight
  const containerHeight = totalHeaderHeight > 0 ? `calc(100vh - ${totalHeaderHeight}px)` : '100vh'

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #fafafa; min-height: 100vh; font-family: system-ui, -apple-system, sans-serif; }
    .toolbar { display: flex; align-items: center; justify-content: space-between; padding: 8px 16px; background: white; border-bottom: 1px solid #e5e7eb; }
    .toolbar-title { font-size: 14px; font-weight: 500; color: #374151; }
    .toolbar-buttons { display: flex; gap: 4px; align-items: center; }
    .toolbar button { padding: 6px; border: none; background: none; cursor: pointer; border-radius: 6px; color: #6b7280; transition: all 0.15s; }
    .toolbar button:hover { background: #f3f4f6; color: #374151; }
    .zoom-text { min-width: 50px; text-align: center; font-size: 13px; font-weight: 500; color: #6b7280; }
    .container { position: relative; width: 100%; height: ${containerHeight}; overflow: hidden; cursor: grab; background: white; background-image: radial-gradient(#e5e7eb 1px, transparent 1px); background-size: 16px 16px; }
    .container.dragging { cursor: grabbing; }
    .container > svg { width: 100%; height: 100%; }
    .branding { position: absolute; bottom: 16px; right: 16px; display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: rgba(255,255,255,0.95); backdrop-filter: blur(8px); border: 1px solid rgba(0,0,0,0.1); border-radius: 8px; font-size: 13px; font-family: system-ui, sans-serif; color: #555; text-decoration: none; transition: all 0.2s; box-shadow: 0 2px 8px rgba(0,0,0,0.1); z-index: 100; }
    .branding:hover { color: #222; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
    .branding-icon { width: 16px; height: 16px; border-radius: 3px; flex-shrink: 0; }
    /* SVG interactive styles */
    .node { cursor: pointer; }
    .node:hover rect, .node:hover circle, .node:hover polygon { filter: brightness(0.95); }
    .port { cursor: pointer; }
    .link-hit-area { cursor: pointer; }
    /* Subgraph click for hierarchical navigation */
    .subgraph[data-has-sheet] { cursor: pointer; }
    .subgraph[data-has-sheet]:hover > rect { filter: brightness(0.95); }
    ${navStyles}
  </style>
</head>
<body>
  ${toolbarHtml}
  ${navToolbarHtml}
  <div class="container" id="container">
    ${svg}
    ${brandingHtml}
  </div>
  <script>${INTERACTIVE_IIFE}</script>
  <script>
    (function() {
      var svg = document.querySelector('#container > svg');
      var container = document.getElementById('container');
      if (!svg || !container) { console.error('SVG or container not found'); return; }

      var vb = { x: 0, y: 0, w: 0, h: 0 };
      var origVb = { x: 0, y: 0, w: 0, h: 0 };
      var drag = { active: false, x: 0, y: 0, vx: 0, vy: 0 };

      function init() {
        var w = parseFloat(svg.getAttribute('width')) || 800;
        var h = parseFloat(svg.getAttribute('height')) || 600;
        var existing = svg.getAttribute('viewBox');
        if (existing) {
          var p = existing.split(/\\s+|,/).map(Number);
          origVb = { x: p[0] || 0, y: p[1] || 0, w: p[2] || w, h: p[3] || h };
        } else {
          origVb = { x: 0, y: 0, w: w, h: h };
        }
        svg.removeAttribute('width');
        svg.removeAttribute('height');
        svg.style.width = '100%';
        svg.style.height = '100%';
        fitView();

        if (window.ShumokuInteractive) {
          window.ShumokuInteractive.initInteractive({ target: svg, modal: { enabled: true }, tooltip: { enabled: true }, panZoom: { enabled: false } });
        }
      }

      function updateViewBox() {
        svg.setAttribute('viewBox', vb.x + ' ' + vb.y + ' ' + vb.w + ' ' + vb.h);
        var zoomEl = document.getElementById('zoom');
        if (zoomEl) zoomEl.textContent = Math.round(origVb.w / vb.w * 100) + '%';
      }

      function fitView() {
        var cw = container.clientWidth || 800;
        var ch = container.clientHeight || 600;
        var scale = Math.min(cw / origVb.w, ch / origVb.h) * 0.9;
        vb.w = cw / scale;
        vb.h = ch / scale;
        vb.x = origVb.x + (origVb.w - vb.w) / 2;
        vb.y = origVb.y + (origVb.h - vb.h) / 2;
        updateViewBox();
      }

      function resetView() {
        vb.x = origVb.x; vb.y = origVb.y; vb.w = origVb.w; vb.h = origVb.h;
        updateViewBox();
      }

      function zoom(f) {
        var cx = vb.x + vb.w / 2, cy = vb.y + vb.h / 2;
        var nw = vb.w / f, nh = vb.h / f;
        var scale = origVb.w / nw;
        if (scale < 0.1 || scale > 10) return;
        vb.w = nw; vb.h = nh; vb.x = cx - nw / 2; vb.y = cy - nh / 2;
        updateViewBox();
      }

      var btnIn = document.getElementById('btn-in');
      var btnOut = document.getElementById('btn-out');
      var btnFit = document.getElementById('btn-fit');
      var btnReset = document.getElementById('btn-reset');
      if (btnIn) btnIn.addEventListener('click', function() { zoom(1.2); });
      if (btnOut) btnOut.addEventListener('click', function() { zoom(1/1.2); });
      if (btnFit) btnFit.addEventListener('click', fitView);
      if (btnReset) btnReset.addEventListener('click', resetView);

      container.addEventListener('wheel', function(e) {
        e.preventDefault();
        var rect = container.getBoundingClientRect();
        var mx = (e.clientX - rect.left) / rect.width;
        var my = (e.clientY - rect.top) / rect.height;
        var px = vb.x + vb.w * mx, py = vb.y + vb.h * my;
        var f = e.deltaY > 0 ? 1/1.2 : 1.2;
        var nw = vb.w / f, nh = vb.h / f;
        var scale = origVb.w / nw;
        if (scale < 0.1 || scale > 10) return;
        vb.w = nw; vb.h = nh; vb.x = px - nw * mx; vb.y = py - nh * my;
        updateViewBox();
      }, { passive: false });

      container.addEventListener('mousedown', function(e) {
        if (e.button === 0) {
          drag = { active: true, x: e.clientX, y: e.clientY, vx: vb.x, vy: vb.y };
          container.classList.add('dragging');
        }
      });

      document.addEventListener('mousemove', function(e) {
        if (!drag.active) return;
        var sx = vb.w / container.clientWidth;
        var sy = vb.h / container.clientHeight;
        vb.x = drag.vx - (e.clientX - drag.x) * sx;
        vb.y = drag.vy - (e.clientY - drag.y) * sy;
        updateViewBox();
      });

      document.addEventListener('mouseup', function() {
        drag.active = false;
        container.classList.remove('dragging');
      });

      // Touch events for pan/zoom
      var pinch = null;
      var touch1 = null;
      var hasMoved = false;
      var DRAG_THRESHOLD = 8;

      function getTouchDist(t) {
        if (t.length < 2) return 0;
        return Math.hypot(t[1].clientX - t[0].clientX, t[1].clientY - t[0].clientY);
      }

      function getTouchCenter(t) {
        return { x: (t[0].clientX + t[1].clientX) / 2, y: (t[0].clientY + t[1].clientY) / 2 };
      }

      container.addEventListener('touchstart', function(e) {
        // Skip if touching branding link
        if (e.target.closest && e.target.closest('.branding')) return;

        if (e.touches.length === 1) {
          // Single finger - potential pan or tap
          touch1 = { x: e.touches[0].clientX, y: e.touches[0].clientY, vx: vb.x, vy: vb.y };
          hasMoved = false;
        } else if (e.touches.length >= 2) {
          // Two fingers - pinch zoom
          e.preventDefault();
          touch1 = null;
          hasMoved = true;
          var dist = getTouchDist(e.touches);
          var center = getTouchCenter(e.touches);
          var rect = container.getBoundingClientRect();
          pinch = {
            dist: dist,
            vb: { x: vb.x, y: vb.y, w: vb.w, h: vb.h },
            cx: vb.x + vb.w * ((center.x - rect.left) / rect.width),
            cy: vb.y + vb.h * ((center.y - rect.top) / rect.height),
            lastCenter: center
          };
        }
      }, { passive: false });

      container.addEventListener('touchmove', function(e) {
        // Skip if touching branding link
        if (e.target.closest && e.target.closest('.branding')) return;

        if (e.touches.length === 1 && touch1) {
          var dx = e.touches[0].clientX - touch1.x;
          var dy = e.touches[0].clientY - touch1.y;

          // Check if moved beyond threshold
          if (!hasMoved && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
            hasMoved = true;
          }

          if (hasMoved) {
            e.preventDefault();
            var sx = vb.w / container.clientWidth;
            var sy = vb.h / container.clientHeight;
            vb.x = touch1.vx - dx * sx;
            vb.y = touch1.vy - dy * sy;
            updateViewBox();
          }
        } else if (e.touches.length >= 2 && pinch) {
          e.preventDefault();
          var dist = getTouchDist(e.touches);
          var center = getTouchCenter(e.touches);
          if (dist === 0 || pinch.dist === 0) return;

          var scale = dist / pinch.dist;
          var nw = pinch.vb.w / scale;
          var nh = pinch.vb.h / scale;
          var newScale = origVb.w / nw;
          if (newScale < 0.1 || newScale > 10) return;

          var rect = container.getBoundingClientRect();
          var sx = nw / rect.width;
          var sy = nh / rect.height;
          var panX = (center.x - pinch.lastCenter.x) * sx;
          var panY = (center.y - pinch.lastCenter.y) * sy;

          var mx = (center.x - rect.left) / rect.width;
          var my = (center.y - rect.top) / rect.height;
          vb.x = pinch.cx - nw * mx - panX;
          vb.y = pinch.cy - nh * my - panY;
          vb.w = nw;
          vb.h = nh;
          updateViewBox();
        }
      }, { passive: false });

      container.addEventListener('touchend', function(e) {
        if (e.touches.length === 0) {
          touch1 = null;
          pinch = null;
          hasMoved = false;
        } else if (e.touches.length === 1) {
          pinch = null;
          touch1 = { x: e.touches[0].clientX, y: e.touches[0].clientY, vx: vb.x, vy: vb.y };
          hasMoved = true; // Already moving
        }
      });

      container.addEventListener('touchcancel', function() {
        touch1 = null;
        pinch = null;
        hasMoved = false;
      });

      // Listen for hierarchical navigation events
      document.addEventListener('shumoku:navigate', function(e) {
        var sheetId = e.detail && e.detail.sheetId;
        if (sheetId) {
          console.log('[Shumoku] Navigate to sheet:', sheetId);
          alert('Navigate to: ' + sheetId + '\\n\\nThis sheet would show the detailed view of this subgraph.');
        }
      });

      init();
    })();
  </script>
  <script>${navScript}</script>
</body>
</html>`
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Generate HTML with multiple embedded sheets for hierarchical navigation
 */
function generateHierarchicalHtml(
  sheetSvgs: Map<string, string>,
  title: string,
  options: Required<RenderOptions>,
): string {
  const brandingHtml = options.branding
    ? `<a class="branding" href="https://shumoku.packof.me" target="_blank" rel="noopener">
      ${BRANDING_ICON_SVG}
      <span>Made with Shumoku</span>
    </a>`
    : ''

  const toolbarHtml = options.toolbar
    ? `<div class="toolbar">
    <span class="toolbar-title" id="sheet-title">${escapeHtml(title)}</span>
    <div class="toolbar-buttons">
      <button id="btn-out" title="Zoom Out"><svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-width="2" d="M20 12H4"/></svg></button>
      <span class="zoom-text" id="zoom">100%</span>
      <button id="btn-in" title="Zoom In"><svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg></button>
      <button id="btn-fit" title="Fit"><svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/></svg></button>
      <button id="btn-reset" title="Reset"><svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg></button>
    </div>
  </div>`
    : ''

  // Build sheet containers
  const sheetContainers: string[] = []
  for (const [sheetId, svg] of sheetSvgs) {
    const isRoot = sheetId === 'root'
    const display = isRoot ? 'block' : 'none'
    sheetContainers.push(
      `<div class="sheet-container" data-sheet-id="${escapeHtml(sheetId)}" style="display: ${display};">
        ${svg}
      </div>`,
    )
  }

  // Build sheet info JSON for JavaScript
  const sheetInfoJson: Record<string, { label: string; parentId?: string }> = {}
  for (const [id, info] of options.navigation?.sheets || []) {
    sheetInfoJson[id] = { label: info.label, parentId: info.parentId }
  }

  const headerHeight = options.toolbar ? 45 : 0
  const containerHeight = headerHeight > 0 ? `calc(100vh - ${headerHeight}px)` : '100vh'

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #fafafa; min-height: 100vh; font-family: system-ui, -apple-system, sans-serif; }
    .toolbar { display: flex; align-items: center; justify-content: space-between; padding: 8px 16px; background: white; border-bottom: 1px solid #e5e7eb; }
    .toolbar-title { font-size: 14px; font-weight: 500; color: #374151; display: flex; align-items: center; gap: 8px; }
    .toolbar-buttons { display: flex; gap: 4px; align-items: center; }
    .toolbar button { padding: 6px; border: none; background: none; cursor: pointer; border-radius: 6px; color: #6b7280; transition: all 0.15s; }
    .toolbar button:hover { background: #f3f4f6; color: #374151; }
    .zoom-text { min-width: 50px; text-align: center; font-size: 13px; font-weight: 500; color: #6b7280; }
    .back-btn { display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; border: 1px solid #e5e7eb; background: white; border-radius: 6px; cursor: pointer; font-size: 13px; color: #6b7280; transition: all 0.15s; }
    .back-btn:hover { background: #f3f4f6; color: #374151; }
    .back-btn svg { width: 14px; height: 14px; }
    .container { position: relative; width: 100%; height: ${containerHeight}; overflow: hidden; cursor: grab; background: white; background-image: radial-gradient(#e5e7eb 1px, transparent 1px); background-size: 16px 16px; }
    .container.dragging { cursor: grabbing; }
    .sheet-container { width: 100%; height: 100%; }
    .sheet-container > svg { width: 100%; height: 100%; }
    .branding { position: absolute; bottom: 16px; right: 16px; display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: rgba(255,255,255,0.95); backdrop-filter: blur(8px); border: 1px solid rgba(0,0,0,0.1); border-radius: 8px; font-size: 13px; font-family: system-ui, sans-serif; color: #555; text-decoration: none; transition: all 0.2s; box-shadow: 0 2px 8px rgba(0,0,0,0.1); z-index: 100; }
    .branding:hover { color: #222; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
    .branding-icon { width: 16px; height: 16px; border-radius: 3px; flex-shrink: 0; }
    .node { cursor: pointer; }
    .node:hover rect, .node:hover circle, .node:hover polygon { filter: brightness(0.95); }
    .port { cursor: pointer; }
    .link-hit-area { cursor: pointer; }
    .subgraph[data-has-sheet] { cursor: pointer; }
    .subgraph[data-has-sheet]:hover > rect { filter: brightness(0.95); }
  </style>
</head>
<body>
  ${toolbarHtml}
  <div class="container" id="container">
    ${sheetContainers.join('\n    ')}
    ${brandingHtml}
  </div>
  <script>${INTERACTIVE_IIFE}</script>
  <script>
    (function() {
      // Zoom Navigation State and Functions
      ${getZoomNavigationScript()}

      var sheetInfo = ${JSON.stringify(sheetInfoJson)};
      var currentSheet = 'root';
      var breadcrumb = ['root'];
      var sheetViewBoxes = {};
      var container = document.getElementById('container');
      var pendingZoomTarget = null;

      function getActiveSheet() {
        return container.querySelector('.sheet-container[data-sheet-id="' + currentSheet + '"]');
      }

      function getActiveSvg() {
        var sheet = getActiveSheet();
        return sheet ? sheet.querySelector('svg') : null;
      }

      function initSheet(sheetId) {
        var sheet = container.querySelector('.sheet-container[data-sheet-id="' + sheetId + '"]');
        if (!sheet) return;
        var svg = sheet.querySelector('svg');
        if (!svg) return;

        var w = parseFloat(svg.getAttribute('width')) || 800;
        var h = parseFloat(svg.getAttribute('height')) || 600;
        var existing = svg.getAttribute('viewBox');
        var vb;
        if (existing) {
          var p = existing.split(/\\s+|,/).map(Number);
          vb = { x: p[0] || 0, y: p[1] || 0, w: p[2] || w, h: p[3] || h, origX: p[0] || 0, origY: p[1] || 0, origW: p[2] || w, origH: p[3] || h };
        } else {
          vb = { x: 0, y: 0, w: w, h: h, origX: 0, origY: 0, origW: w, origH: h };
        }
        sheetViewBoxes[sheetId] = vb;

        svg.removeAttribute('width');
        svg.removeAttribute('height');
        svg.style.width = '100%';
        svg.style.height = '100%';

        // Fit view
        var cw = container.clientWidth || 800;
        var ch = container.clientHeight || 600;
        var scale = Math.min(cw / vb.origW, ch / vb.origH) * 0.9;
        vb.w = cw / scale;
        vb.h = ch / scale;
        vb.x = vb.origX + (vb.origW - vb.w) / 2;
        vb.y = vb.origY + (vb.origH - vb.h) / 2;
        svg.setAttribute('viewBox', vb.x + ' ' + vb.y + ' ' + vb.w + ' ' + vb.h);

        if (window.ShumokuInteractive) {
          window.ShumokuInteractive.initInteractive({ target: svg, modal: { enabled: true }, tooltip: { enabled: true }, panZoom: { enabled: false } });
        }
      }

      function updateViewBox() {
        var svg = getActiveSvg();
        var vb = sheetViewBoxes[currentSheet];
        if (!svg || !vb) return;
        svg.setAttribute('viewBox', vb.x + ' ' + vb.y + ' ' + vb.w + ' ' + vb.h);
        var zoomEl = document.getElementById('zoom');
        if (zoomEl) zoomEl.textContent = Math.round(vb.origW / vb.w * 100) + '%';
      }

      function updateTitle() {
        var titleEl = document.getElementById('sheet-title');
        if (!titleEl) return;
        var info = sheetInfo[currentSheet];
        var label = info ? info.label : currentSheet;

        if (currentSheet === 'root') {
          titleEl.textContent = label;
        } else {
          titleEl.textContent = '';
          var backBtn = document.createElement('button');
          backBtn.className = 'back-btn';
          backBtn.id = 'back-btn';
          backBtn.innerHTML = '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>';
          backBtn.addEventListener('click', function() {
            navigateToSheet('root');
          });
          titleEl.appendChild(backBtn);
          titleEl.appendChild(document.createTextNode(label));
        }
      }

      function navigateToSheet(sheetId) {
        if (sheetId === currentSheet) return;
        if (!container.querySelector('.sheet-container[data-sheet-id="' + sheetId + '"]')) {
          console.warn('[Shumoku] Sheet not found:', sheetId);
          return;
        }

        // Hide current
        var current = getActiveSheet();
        if (current) current.style.display = 'none';

        // Show new
        currentSheet = sheetId;
        var newSheet = getActiveSheet();
        if (newSheet) {
          newSheet.style.display = 'block';
          if (!sheetViewBoxes[sheetId]) {
            initSheet(sheetId);
          }
        }

        // Update breadcrumb
        if (sheetId === 'root') {
          breadcrumb = ['root'];
        } else {
          breadcrumb = ['root', sheetId];
        }

        updateTitle();
        updateViewBox();
      }

      // Zoom functions
      function zoom(f) {
        var vb = sheetViewBoxes[currentSheet];
        if (!vb) return;
        var cx = vb.x + vb.w / 2, cy = vb.y + vb.h / 2;
        var nw = vb.w / f, nh = vb.h / f;
        var scale = vb.origW / nw;
        if (scale < 0.1 || scale > 10) return;
        vb.w = nw; vb.h = nh; vb.x = cx - nw / 2; vb.y = cy - nh / 2;
        updateViewBox();
      }

      function fitView() {
        var vb = sheetViewBoxes[currentSheet];
        if (!vb) return;
        var cw = container.clientWidth || 800;
        var ch = container.clientHeight || 600;
        var scale = Math.min(cw / vb.origW, ch / vb.origH) * 0.9;
        vb.w = cw / scale;
        vb.h = ch / scale;
        vb.x = vb.origX + (vb.origW - vb.w) / 2;
        vb.y = vb.origY + (vb.origH - vb.h) / 2;
        updateViewBox();
      }

      function resetView() {
        var vb = sheetViewBoxes[currentSheet];
        if (!vb) return;
        vb.x = vb.origX; vb.y = vb.origY; vb.w = vb.origW; vb.h = vb.origH;
        updateViewBox();
      }

      // Toolbar buttons
      var btnIn = document.getElementById('btn-in');
      var btnOut = document.getElementById('btn-out');
      var btnFit = document.getElementById('btn-fit');
      var btnReset = document.getElementById('btn-reset');
      if (btnIn) btnIn.addEventListener('click', function() { zoom(1.2); });
      if (btnOut) btnOut.addEventListener('click', function() { zoom(1/1.2); });
      if (btnFit) btnFit.addEventListener('click', fitView);
      if (btnReset) btnReset.addEventListener('click', resetView);

      // Mouse drag
      var drag = { active: false, x: 0, y: 0 };

      container.addEventListener('mousedown', function(e) {
        if (e.button === 0 && !zoomNavState.isAnimating) {
          var vb = sheetViewBoxes[currentSheet];
          if (!vb) return;
          drag = { active: true, x: e.clientX, y: e.clientY, vx: vb.x, vy: vb.y };
          container.classList.add('dragging');
        }
      });

      document.addEventListener('mousemove', function(e) {
        if (!drag.active) return;
        var vb = sheetViewBoxes[currentSheet];
        if (!vb) return;
        var sx = vb.w / container.clientWidth;
        var sy = vb.h / container.clientHeight;
        vb.x = drag.vx - (e.clientX - drag.x) * sx;
        vb.y = drag.vy - (e.clientY - drag.y) * sy;
        updateViewBox();
      });

      document.addEventListener('mouseup', function() {
        drag.active = false;
        container.classList.remove('dragging');
      });

      // Wheel zoom with navigation detection
      var lastWheelX = 0;
      var lastWheelY = 0;
      var wheelEndTimeout = null;

      function checkZoomInTransition() {
        if (zoomNavState.isAnimating) return;

        var vb = sheetViewBoxes[currentSheet];
        if (!vb) return;

        var scale = calculateScale(vb);
        var target = pickSubgraphTarget(lastWheelX, lastWheelY);

        if (target && shouldTriggerZoomIn(vb, target.bounds, scale)) {
          pendingZoomTarget = target;

          animateZoomToBounds(
            vb,
            target.bounds,
            function(newVb) {
              vb.x = newVb.x;
              vb.y = newVb.y;
              vb.w = newVb.w;
              vb.h = newVb.h;
              updateViewBox();
            },
            function() {
              // Sheet switch at 80%
              if (pendingZoomTarget) {
                if (!sheetViewBoxes[pendingZoomTarget.sheetId]) {
                  initSheet(pendingZoomTarget.sheetId);
                }
                var cw = container.clientWidth || 800;
                var ch = container.clientHeight || 600;
                initChildViewBox(pendingZoomTarget.sheetId, cw, ch);
                navigateToSheet(pendingZoomTarget.sheetId);
              }
            },
            function() {
              pendingZoomTarget = null;
            }
          );
        }
      }

      function checkZoomOutTransition() {
        if (zoomNavState.isAnimating) return;
        if (currentSheet === 'root') return;

        var vb = sheetViewBoxes[currentSheet];
        if (!vb) return;

        var scale = calculateScale(vb);
        var info = sheetInfo[currentSheet];
        var parentId = info && info.parentId ? info.parentId : 'root';

        if (shouldTriggerZoomOut(vb, scale, currentSheet)) {
          animateZoomOut(
            vb,
            function(newVb) {
              vb.x = newVb.x;
              vb.y = newVb.y;
              vb.w = newVb.w;
              vb.h = newVb.h;
              updateViewBox();
            },
            function() {
              // Sheet switch at 80%
              navigateToSheet(parentId);
            },
            function() {
              // Animation complete
            }
          );
        }
      }

      function handleWheelEnd() {
        var vb = sheetViewBoxes[currentSheet];
        if (!vb) return;

        var scale = calculateScale(vb);

        if (scale >= ZOOM_IN_SCALE_THRESHOLD) {
          checkZoomInTransition();
        } else if (scale <= ZOOM_OUT_SCALE_THRESHOLD) {
          checkZoomOutTransition();
        }
      }

      container.addEventListener('wheel', function(e) {
        if (zoomNavState.isAnimating) {
          e.preventDefault();
          return;
        }

        e.preventDefault();
        var vb = sheetViewBoxes[currentSheet];
        if (!vb) return;
        var rect = container.getBoundingClientRect();
        var mx = (e.clientX - rect.left) / rect.width;
        var my = (e.clientY - rect.top) / rect.height;
        var px = vb.x + vb.w * mx, py = vb.y + vb.h * my;
        var f = e.deltaY > 0 ? 1/1.2 : 1.2;
        var nw = vb.w / f, nh = vb.h / f;
        var scale = vb.origW / nw;
        if (scale < 0.1 || scale > 10) return;
        vb.w = nw; vb.h = nh; vb.x = px - nw * mx; vb.y = py - nh * my;
        updateViewBox();

        // Track wheel position for transition detection
        lastWheelX = e.clientX;
        lastWheelY = e.clientY;

        // Debounce wheel end detection
        if (wheelEndTimeout) {
          clearTimeout(wheelEndTimeout);
        }
        wheelEndTimeout = setTimeout(handleWheelEnd, 150);
      }, { passive: false });

      // Navigation event listener
      document.addEventListener('shumoku:navigate', function(e) {
        var sheetId = e.detail && e.detail.sheetId;
        if (sheetId) {
          navigateToSheet(sheetId);
        }
      });

      // Double-click navigation (supplementary to zoom-based navigation)
      var lastClickTime = 0;
      var lastClickTarget = null;

      container.addEventListener('click', function(e) {
        if (zoomNavState.isAnimating) return;

        var now = Date.now();
        var target = e.target.closest ? e.target.closest('.subgraph[data-has-sheet]') : null;

        if (target && target === lastClickTarget && now - lastClickTime < 300) {
          // Double-click detected - trigger animated navigation
          e.preventDefault();
          e.stopPropagation();

          var sheetId = target.getAttribute('data-sheet-id');
          var boundsStr = target.getAttribute('data-bounds');

          if (sheetId && boundsStr) {
            try {
              var bounds = JSON.parse(boundsStr.replace(/&quot;/g, '"'));
              var vb = sheetViewBoxes[currentSheet];

              if (vb) {
                pendingZoomTarget = { sheetId: sheetId, bounds: bounds };

                animateZoomToBounds(
                  vb,
                  bounds,
                  function(newVb) {
                    vb.x = newVb.x;
                    vb.y = newVb.y;
                    vb.w = newVb.w;
                    vb.h = newVb.h;
                    updateViewBox();
                  },
                  function() {
                    if (pendingZoomTarget) {
                      if (!sheetViewBoxes[pendingZoomTarget.sheetId]) {
                        initSheet(pendingZoomTarget.sheetId);
                      }
                      var cw = container.clientWidth || 800;
                      var ch = container.clientHeight || 600;
                      initChildViewBox(pendingZoomTarget.sheetId, cw, ch);
                      navigateToSheet(pendingZoomTarget.sheetId);
                    }
                  },
                  function() {
                    pendingZoomTarget = null;
                  }
                );
              }
            } catch (err) {
              console.warn('[Shumoku] Failed to parse bounds:', err);
            }
          }

          lastClickTarget = null;
        } else {
          // Single click - record for potential double-click
          lastClickTarget = target;
          lastClickTime = now;
        }
      });

      // Touch support with pinch zoom and navigation detection
      var touch1 = null;
      var pinch = null;
      var hasMoved = false;
      var DRAG_THRESHOLD = 8;
      var pinchEndTimeout = null;
      var lastPinchCenterX = 0;
      var lastPinchCenterY = 0;

      function getTouchDist(t) {
        if (t.length < 2) return 0;
        return Math.hypot(t[1].clientX - t[0].clientX, t[1].clientY - t[0].clientY);
      }

      function getTouchCenter(t) {
        return { x: (t[0].clientX + t[1].clientX) / 2, y: (t[0].clientY + t[1].clientY) / 2 };
      }

      function handlePinchEnd() {
        var vb = sheetViewBoxes[currentSheet];
        if (!vb) return;

        var scale = calculateScale(vb);

        if (scale >= ZOOM_IN_SCALE_THRESHOLD) {
          // Check for zoom-in transition using last pinch center
          if (zoomNavState.isAnimating) return;

          var target = pickSubgraphTarget(lastPinchCenterX, lastPinchCenterY);
          if (target && shouldTriggerZoomIn(vb, target.bounds, scale)) {
            pendingZoomTarget = target;

            animateZoomToBounds(
              vb,
              target.bounds,
              function(newVb) {
                vb.x = newVb.x;
                vb.y = newVb.y;
                vb.w = newVb.w;
                vb.h = newVb.h;
                updateViewBox();
              },
              function() {
                if (pendingZoomTarget) {
                  if (!sheetViewBoxes[pendingZoomTarget.sheetId]) {
                    initSheet(pendingZoomTarget.sheetId);
                  }
                  var cw = container.clientWidth || 800;
                  var ch = container.clientHeight || 600;
                  initChildViewBox(pendingZoomTarget.sheetId, cw, ch);
                  navigateToSheet(pendingZoomTarget.sheetId);
                }
              },
              function() {
                pendingZoomTarget = null;
              }
            );
          }
        } else if (scale <= ZOOM_OUT_SCALE_THRESHOLD) {
          checkZoomOutTransition();
        }
      }

      container.addEventListener('touchstart', function(e) {
        if (e.target.closest && e.target.closest('.branding')) return;
        if (zoomNavState.isAnimating) {
          e.preventDefault();
          return;
        }

        if (e.touches.length === 1) {
          var vb = sheetViewBoxes[currentSheet];
          if (vb) {
            touch1 = { x: e.touches[0].clientX, y: e.touches[0].clientY, vx: vb.x, vy: vb.y };
            hasMoved = false;
          }
        } else if (e.touches.length >= 2) {
          e.preventDefault();
          touch1 = null;
          hasMoved = true;
          var vb = sheetViewBoxes[currentSheet];
          if (!vb) return;
          var dist = getTouchDist(e.touches);
          var center = getTouchCenter(e.touches);
          var rect = container.getBoundingClientRect();
          pinch = {
            dist: dist,
            vb: { x: vb.x, y: vb.y, w: vb.w, h: vb.h },
            cx: vb.x + vb.w * ((center.x - rect.left) / rect.width),
            cy: vb.y + vb.h * ((center.y - rect.top) / rect.height),
            lastCenter: center
          };
          lastPinchCenterX = center.x;
          lastPinchCenterY = center.y;
        }
      }, { passive: false });

      container.addEventListener('touchmove', function(e) {
        if (e.target.closest && e.target.closest('.branding')) return;
        if (zoomNavState.isAnimating) {
          e.preventDefault();
          return;
        }

        if (e.touches.length === 1 && touch1) {
          var vb = sheetViewBoxes[currentSheet];
          if (!vb) return;
          var dx = e.touches[0].clientX - touch1.x;
          var dy = e.touches[0].clientY - touch1.y;
          if (!hasMoved && Math.hypot(dx, dy) > DRAG_THRESHOLD) hasMoved = true;
          if (hasMoved) {
            e.preventDefault();
            var sx = vb.w / container.clientWidth;
            var sy = vb.h / container.clientHeight;
            vb.x = touch1.vx - dx * sx;
            vb.y = touch1.vy - dy * sy;
            updateViewBox();
          }
        } else if (e.touches.length >= 2 && pinch) {
          e.preventDefault();
          var vb = sheetViewBoxes[currentSheet];
          if (!vb) return;
          var dist = getTouchDist(e.touches);
          var center = getTouchCenter(e.touches);
          if (dist === 0 || pinch.dist === 0) return;

          var scale = dist / pinch.dist;
          var nw = pinch.vb.w / scale;
          var nh = pinch.vb.h / scale;
          var newScale = vb.origW / nw;
          if (newScale < 0.1 || newScale > 10) return;

          var rect = container.getBoundingClientRect();
          var sx = nw / rect.width;
          var sy = nh / rect.height;
          var panX = (center.x - pinch.lastCenter.x) * sx;
          var panY = (center.y - pinch.lastCenter.y) * sy;

          var mx = (center.x - rect.left) / rect.width;
          var my = (center.y - rect.top) / rect.height;
          vb.x = pinch.cx - nw * mx - panX;
          vb.y = pinch.cy - nh * my - panY;
          vb.w = nw;
          vb.h = nh;
          updateViewBox();

          lastPinchCenterX = center.x;
          lastPinchCenterY = center.y;
        }
      }, { passive: false });

      container.addEventListener('touchend', function(e) {
        if (e.touches.length === 0) {
          if (pinch) {
            // Pinch ended - check for navigation transition
            if (pinchEndTimeout) clearTimeout(pinchEndTimeout);
            pinchEndTimeout = setTimeout(handlePinchEnd, 150);
          }
          touch1 = null;
          pinch = null;
          hasMoved = false;
        } else if (e.touches.length === 1) {
          pinch = null;
          var vb = sheetViewBoxes[currentSheet];
          if (vb) {
            touch1 = { x: e.touches[0].clientX, y: e.touches[0].clientY, vx: vb.x, vy: vb.y };
          }
          hasMoved = true;
        }
      });

      container.addEventListener('touchcancel', function() {
        touch1 = null;
        pinch = null;
        hasMoved = false;
      });

      // Initialize root sheet
      initSheet('root');
      updateTitle();
    })();
  </script>
</body>
</html>`
}
