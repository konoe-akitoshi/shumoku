/**
 * Metrics-enabled HTML Generator
 * Generates HTML pages with real-time metrics update capability
 */

import { svg as svgRenderer } from '@shumoku/renderer'
import type { TopologyInstance, WeathermapConfig } from './types.js'

export interface HtmlGeneratorOptions {
  wsUrl: string
  weathermap: WeathermapConfig
}

/**
 * Generate a complete HTML page with metrics support
 */
export function generateMetricsHtml(
  instance: TopologyInstance,
  options: HtmlGeneratorOptions,
): string {
  const { graph, layout } = instance
  const svgContent = svgRenderer.render(graph, layout, { renderMode: 'interactive' })
  const title = graph.name || instance.name

  const metricsRuntimeScript = generateMetricsRuntimeScript(options)
  const weathermapScript = generateWeathermapScript(options.weathermap)

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} - Shumoku</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #fafafa;
      min-height: 100vh;
      font-family: system-ui, -apple-system, sans-serif;
    }
    .toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 16px;
      background: white;
      border-bottom: 1px solid #e5e7eb;
    }
    .toolbar-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .toolbar-title {
      font-size: 14px;
      font-weight: 500;
      color: #374151;
    }
    .toolbar-buttons {
      display: flex;
      gap: 4px;
      align-items: center;
    }
    .toolbar button {
      padding: 6px;
      border: none;
      background: none;
      cursor: pointer;
      border-radius: 6px;
      color: #6b7280;
      transition: all 0.15s;
    }
    .toolbar button:hover { background: #f3f4f6; color: #374151; }
    .zoom-text {
      min-width: 50px;
      text-align: center;
      font-size: 13px;
      font-weight: 500;
      color: #6b7280;
    }
    .status-indicator {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: #6b7280;
    }
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #9ca3af;
    }
    .status-dot.connected { background: #22c55e; }
    .status-dot.disconnected { background: #ef4444; }
    .interval-select {
      font-size: 12px;
      padding: 4px 8px;
      border: 1px solid #e5e7eb;
      border-radius: 4px;
      background: white;
      color: #374151;
    }
    .container {
      position: relative;
      width: 100%;
      height: calc(100vh - 45px);
      overflow: hidden;
      cursor: grab;
      background: white;
      background-image: radial-gradient(#e5e7eb 1px, transparent 1px);
      background-size: 16px 16px;
    }
    .container.dragging { cursor: grabbing; }
    .container > svg {
      width: 100%;
      height: 100%;
    }
    .branding {
      position: absolute;
      bottom: 16px;
      right: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: rgba(255,255,255,0.95);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(0,0,0,0.1);
      border-radius: 8px;
      font-size: 13px;
      font-family: system-ui, sans-serif;
      color: #555;
      text-decoration: none;
      transition: all 0.2s;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      z-index: 100;
    }
    .branding:hover { color: #222; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
    .branding-icon { width: 16px; height: 16px; border-radius: 3px; flex-shrink: 0; }
    /* Node status indicators */
    .node-down rect,
    .node-down circle,
    .node-down polygon {
      fill: #fecaca !important;
      stroke: #ef4444 !important;
    }
    .node-down .node-label { fill: #7f1d1d !important; }
    /* Link status indicators */
    .link-down path { stroke: #ef4444 !important; stroke-dasharray: 5 3 !important; }
    /* Interactive styles */
    .node { cursor: pointer; }
    .node:hover rect, .node:hover circle, .node:hover polygon { filter: brightness(0.95); }
  </style>
</head>
<body>
  <div class="toolbar">
    <div class="toolbar-left">
      <a href="/" style="text-decoration: none; color: inherit;">
        <svg viewBox="0 0 1024 1024" width="24" height="24" fill="none">
          <rect x="64" y="64" width="896" height="896" rx="200" fill="#7FE4C1"/>
          <g transform="translate(90,40) scale(1.25)">
            <path fill="#1F2328" d="M380 340H450V505H700V555H510V645H450V645H380Z"/>
          </g>
        </svg>
      </a>
      <span class="toolbar-title">${escapeHtml(title)}</span>
      <div class="status-indicator">
        <span class="status-dot" id="ws-status"></span>
        <span id="ws-status-text">Connecting...</span>
      </div>
    </div>
    <div class="toolbar-buttons">
      <select class="interval-select" id="interval-select">
        <option value="5000">5s</option>
        <option value="10000">10s</option>
        <option value="30000" selected>30s</option>
        <option value="60000">1m</option>
        <option value="300000">5m</option>
      </select>
      <button id="btn-out" title="Zoom Out">
        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-width="2" d="M20 12H4"/>
        </svg>
      </button>
      <span class="zoom-text" id="zoom">100%</span>
      <button id="btn-in" title="Zoom In">
        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-width="2" d="M12 4v16m8-8H4"/>
        </svg>
      </button>
      <button id="btn-fit" title="Fit">
        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/>
        </svg>
      </button>
      <button id="btn-reset" title="Reset">
        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
        </svg>
      </button>
    </div>
  </div>
  <div class="container" id="container">
    ${svgContent}
    <a class="branding" href="https://shumoku.packof.me" target="_blank" rel="noopener">
      <svg class="branding-icon" viewBox="0 0 1024 1024" fill="none">
        <rect x="64" y="64" width="896" height="896" rx="200" fill="#7FE4C1"/>
        <g transform="translate(90,40) scale(1.25)">
          <path fill="#1F2328" d="M380 340H450V505H700V555H510V645H450V645H380Z"/>
        </g>
      </svg>
      <span>Made with Shumoku</span>
    </a>
  </div>
  <script>
    ${weathermapScript}
    ${metricsRuntimeScript}
    ${generatePanZoomScript()}
  </script>
</body>
</html>`
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function generateWeathermapScript(config: WeathermapConfig): string {
  return `
// Weathermap color calculation
var weathermapThresholds = ${JSON.stringify(config.thresholds)};

function getUtilizationColor(utilization) {
  if (utilization === undefined || utilization === null) {
    return '#94a3b8'; // Default gray
  }

  // Find the two thresholds to interpolate between
  var lower = weathermapThresholds[0];
  var upper = weathermapThresholds[weathermapThresholds.length - 1];

  for (var i = 0; i < weathermapThresholds.length - 1; i++) {
    if (utilization >= weathermapThresholds[i].value &&
        utilization < weathermapThresholds[i + 1].value) {
      lower = weathermapThresholds[i];
      upper = weathermapThresholds[i + 1];
      break;
    }
  }

  // Linear interpolation between colors
  var range = upper.value - lower.value;
  var t = range > 0 ? (utilization - lower.value) / range : 0;

  return interpolateColor(lower.color, upper.color, t);
}

function interpolateColor(color1, color2, t) {
  // Parse hex colors
  var r1 = parseInt(color1.slice(1, 3), 16);
  var g1 = parseInt(color1.slice(3, 5), 16);
  var b1 = parseInt(color1.slice(5, 7), 16);

  var r2 = parseInt(color2.slice(1, 3), 16);
  var g2 = parseInt(color2.slice(3, 5), 16);
  var b2 = parseInt(color2.slice(5, 7), 16);

  // Interpolate
  var r = Math.round(r1 + (r2 - r1) * t);
  var g = Math.round(g1 + (g2 - g1) * t);
  var b = Math.round(b1 + (b2 - b1) * t);

  // Return hex
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
`
}

function generateMetricsRuntimeScript(options: HtmlGeneratorOptions): string {
  return `
// Metrics Runtime
(function() {
  var wsUrl = '${options.wsUrl}';
  var topologyName = '${options.wsUrl.includes('/ws') ? '' : 'sample-network'}';
  var ws = null;
  var reconnectAttempts = 0;
  var maxReconnectAttempts = 10;
  var pendingUpdates = new Map();
  var animFrameId = null;

  var statusDot = document.getElementById('ws-status');
  var statusText = document.getElementById('ws-status-text');
  var intervalSelect = document.getElementById('interval-select');
  var svg = document.querySelector('#container > svg');

  function updateStatus(connected) {
    if (statusDot) {
      statusDot.classList.toggle('connected', connected);
      statusDot.classList.toggle('disconnected', !connected);
    }
    if (statusText) {
      statusText.textContent = connected ? 'Connected' : 'Disconnected';
    }
  }

  function connect() {
    try {
      ws = new WebSocket(wsUrl);

      ws.onopen = function() {
        console.log('[Metrics] WebSocket connected');
        updateStatus(true);
        reconnectAttempts = 0;

        // Subscribe to topology
        var topoName = window.location.pathname.split('/topology/')[1];
        if (topoName) {
          topoName = decodeURIComponent(topoName);
        } else {
          topoName = 'sample-network';
        }
        ws.send(JSON.stringify({ type: 'subscribe', topology: topoName }));

        // Set initial interval
        var interval = parseInt(intervalSelect?.value || '30000', 10);
        ws.send(JSON.stringify({ type: 'setInterval', interval: interval }));
      };

      ws.onmessage = function(event) {
        try {
          var msg = JSON.parse(event.data);
          if (msg.type === 'metrics') {
            handleMetricsUpdate(msg.data);
          }
        } catch (err) {
          console.error('[Metrics] Failed to parse message:', err);
        }
      };

      ws.onclose = function() {
        console.log('[Metrics] WebSocket closed');
        updateStatus(false);
        scheduleReconnect();
      };

      ws.onerror = function(err) {
        console.error('[Metrics] WebSocket error:', err);
        updateStatus(false);
      };
    } catch (err) {
      console.error('[Metrics] Failed to connect:', err);
      scheduleReconnect();
    }
  }

  function scheduleReconnect() {
    if (reconnectAttempts < maxReconnectAttempts) {
      var delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
      reconnectAttempts++;
      console.log('[Metrics] Reconnecting in ' + delay + 'ms (attempt ' + reconnectAttempts + ')');
      setTimeout(connect, delay);
    }
  }

  function handleMetricsUpdate(data) {
    // Buffer updates for batch processing
    if (data.links) {
      for (var linkId in data.links) {
        pendingUpdates.set('link:' + linkId, data.links[linkId]);
      }
    }
    if (data.nodes) {
      for (var nodeId in data.nodes) {
        pendingUpdates.set('node:' + nodeId, data.nodes[nodeId]);
      }
    }

    // Schedule batch update
    if (!animFrameId) {
      animFrameId = requestAnimationFrame(applyUpdates);
    }
  }

  function applyUpdates() {
    animFrameId = null;

    pendingUpdates.forEach(function(data, key) {
      var parts = key.split(':');
      var type = parts[0];
      var id = parts.slice(1).join(':');

      if (type === 'link') {
        updateLink(id, data);
      } else if (type === 'node') {
        updateNode(id, data);
      }
    });

    pendingUpdates.clear();
  }

  function updateLink(linkId, data) {
    var linkGroup = svg?.querySelector('[data-link-id="' + linkId + '"]');
    if (!linkGroup) return;

    // Update link color based on utilization
    var paths = linkGroup.querySelectorAll('path.link');
    var color = data.status === 'down' ? '#ef4444' : getUtilizationColor(data.utilization);

    paths.forEach(function(path) {
      path.setAttribute('stroke', color);
      if (data.status === 'down') {
        path.setAttribute('stroke-dasharray', '5 3');
      } else {
        path.removeAttribute('stroke-dasharray');
      }
    });

    // Toggle down class
    linkGroup.classList.toggle('link-down', data.status === 'down');
  }

  function updateNode(nodeId, data) {
    var nodeGroup = svg?.querySelector('.node[data-id="' + nodeId + '"]');
    if (!nodeGroup) return;

    // Toggle down class
    nodeGroup.classList.toggle('node-down', data.status === 'down');
  }

  // Interval change handler
  if (intervalSelect) {
    intervalSelect.addEventListener('change', function() {
      var interval = parseInt(intervalSelect.value, 10);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'setInterval', interval: interval }));
      }
    });
  }

  // Start connection
  connect();
})();
`
}

function generatePanZoomScript(): string {
  return `
// Pan and Zoom
(function() {
  var svg = document.querySelector('#container > svg');
  var container = document.getElementById('container');
  if (!svg || !container) return;

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

  document.getElementById('btn-in')?.addEventListener('click', function() { zoom(1.2); });
  document.getElementById('btn-out')?.addEventListener('click', function() { zoom(1/1.2); });
  document.getElementById('btn-fit')?.addEventListener('click', fitView);
  document.getElementById('btn-reset')?.addEventListener('click', resetView);

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

  init();
})();
`
}
