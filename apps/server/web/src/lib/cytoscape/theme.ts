/**
 * Cytoscape Theme - Shared styling based on @shumoku/core themes
 * This module converts shumoku themes to Cytoscape stylesheets
 */

import type { Stylesheet } from 'cytoscape'

// Re-export formatTraffic from shared utils
export { formatTraffic } from '$lib/utils/format'

// Device type colors (matching @shumoku/core dark theme)
export const deviceColors: Record<string, string> = {
  router: '#60a5fa',
  'l3-switch': '#a78bfa',
  'l2-switch': '#c4b5fd',
  firewall: '#f87171',
  'load-balancer': '#fbbf24',
  server: '#34d399',
  'access-point': '#22d3ee',
  cloud: '#60a5fa',
  internet: '#818cf8',
  vpn: '#818cf8',
  generic: '#64748b',
  connector: '#94a3b8',
}

// Utilization color scale (weathermap style)
export const utilizationColors = [
  { max: 0, color: '#64748b' }, // Gray - no traffic
  { max: 1, color: '#22c55e' }, // Green - minimal
  { max: 25, color: '#84cc16' }, // Light green
  { max: 50, color: '#eab308' }, // Yellow
  { max: 75, color: '#f97316' }, // Orange
  { max: 90, color: '#ef4444' }, // Red
  { max: 100, color: '#dc2626' }, // Dark red
]

export function getUtilizationColor(utilization: number): string {
  for (const t of utilizationColors) {
    if (utilization <= t.max) return t.color
  }
  return '#dc2626'
}

// Status colors
export const statusColors = {
  up: '#22c55e',
  down: '#ef4444',
  unknown: '#64748b',
}

/**
 * Generate Cytoscape stylesheet for dark theme
 */
export function createDarkStylesheet(): Stylesheet[] {
  return [
    // ========== Base Node Style ==========
    {
      selector: 'node',
      style: {
        'background-color': '#1e293b',
        'border-width': 2,
        'border-color': '#64748b',
        label: 'data(label)',
        'text-valign': 'bottom',
        'text-halign': 'center',
        'text-margin-y': 8,
        'font-size': 11,
        'font-family': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: '#e2e8f0',
        'text-outline-color': '#0f172a',
        'text-outline-width': 2,
        width: 60,
        height: 40,
        shape: 'round-rectangle',
        'transition-property': 'border-color, border-width, background-color, opacity',
        'transition-duration': 200,
      },
    },

    // ========== Device Type Colors ==========
    ...Object.entries(deviceColors).map(([type, color]) => ({
      selector: `node[type="${type}"]`,
      style: {
        'border-color': color,
        'background-color': color + '20', // 20% opacity
      },
    })),

    // ========== Compound Nodes (Subgraphs) ==========
    {
      selector: 'node:parent',
      style: {
        'background-color': '#1e293b',
        'background-opacity': 0.7,
        'border-width': 2,
        'border-color': '#475569',
        'border-style': 'solid',
        padding: 24,
        'text-valign': 'top',
        'text-halign': 'center',
        'text-margin-y': -8,
        'font-size': 13,
        'font-weight': 600,
        color: '#94a3b8',
        shape: 'round-rectangle',
      },
    },

    // Subgraph with custom style
    {
      selector: 'node:parent[subgraphFill]',
      style: {
        'background-color': 'data(subgraphFill)',
        'background-opacity': 0.3,
      },
    },
    {
      selector: 'node:parent[subgraphStroke]',
      style: {
        'border-color': 'data(subgraphStroke)',
      },
    },

    // ========== Edges (Links) ==========
    {
      selector: 'edge',
      style: {
        width: 2,
        'line-color': '#64748b',
        'target-arrow-color': '#64748b',
        'curve-style': 'bezier',
        label: 'data(label)',
        'font-size': 9,
        color: '#94a3b8',
        'text-outline-color': '#0f172a',
        'text-outline-width': 2,
        'text-rotation': 'autorotate',
        'text-margin-y': -10,
        'transition-property': 'line-color, width, opacity',
        'transition-duration': 200,
      },
    },

    // Edge with arrow
    {
      selector: 'edge[arrow]',
      style: {
        'target-arrow-shape': 'triangle',
        'arrow-scale': 1,
      },
    },

    // Dashed edge (VPN, etc.)
    {
      selector: 'edge[lineStyle="dashed"]',
      style: {
        'line-style': 'dashed',
        'line-dash-pattern': [8, 4],
      },
    },

    // ========== Node with Icon ==========
    {
      selector: 'node[iconUrl]',
      style: {
        'background-image': 'data(iconUrl)',
        'background-fit': 'contain',
        'background-clip': 'none',
        'background-image-opacity': 1,
        'background-color': '#1e293b',
        'border-width': 0,
        width: 48,
        height: 48,
      },
    },

    // ========== Hover State ==========
    {
      selector: 'node:active',
      style: {
        'overlay-color': '#60a5fa',
        'overlay-padding': 8,
        'overlay-opacity': 0.2,
      },
    },
    {
      selector: 'edge:active',
      style: {
        'overlay-color': '#60a5fa',
        'overlay-padding': 4,
        'overlay-opacity': 0.2,
      },
    },

    // ========== Selection State ==========
    {
      selector: 'node:selected',
      style: {
        'border-width': 3,
        'border-color': '#60a5fa',
        'box-shadow': '0 0 0 4px rgba(96, 165, 250, 0.3)',
      },
    },
    {
      selector: 'edge:selected',
      style: {
        width: 4,
        'line-color': '#60a5fa',
        'target-arrow-color': '#60a5fa',
      },
    },

    // ========== Highlighted State (for neighbors) ==========
    {
      selector: '.highlighted',
      style: {
        'border-color': '#fbbf24',
        'border-width': 3,
      },
    },
    {
      selector: 'edge.highlighted',
      style: {
        'line-color': '#fbbf24',
        width: 3,
      },
    },

    // ========== Faded State (non-highlighted) ==========
    {
      selector: '.faded',
      style: {
        opacity: 0.25,
      },
    },

    // ========== Status Indicators ==========
    {
      selector: 'node[status="up"]',
      style: {
        'border-color': '#22c55e',
        'border-width': 3,
      },
    },
    {
      selector: 'node[status="down"]',
      style: {
        'border-color': '#ef4444',
        'border-width': 3,
        'border-style': 'dashed',
      },
    },
    {
      selector: 'edge[status="down"]',
      style: {
        'line-color': '#ef4444',
        'line-style': 'dashed',
      },
    },

    // ========== Export Connector Nodes ==========
    {
      selector: 'node[isExport="true"]',
      style: {
        shape: 'ellipse',
        'background-color': '#374151',
        'border-color': '#60a5fa',
        'border-style': 'dashed',
        width: 80,
        height: 30,
        'font-size': 10,
        'text-valign': 'center',
        'text-margin-y': 0,
      },
    },
  ]
}
