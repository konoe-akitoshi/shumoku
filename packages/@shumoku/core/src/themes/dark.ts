/**
 * Dark theme
 */

import { DeviceType } from '../models/index.js'
import { lightTheme } from './light.js'
import type { Theme } from './types.js'

export const darkTheme: Theme = {
  ...lightTheme,
  name: 'dark',
  variant: 'dark',

  colors: {
    ...lightTheme.colors,

    // Backgrounds (inverted)
    background: '#0f172a',
    surface: '#1e293b',
    surfaceHover: '#334155',

    // Text (inverted)
    text: '#f1f5f9',
    textSecondary: '#94a3b8',
    textDisabled: '#475569',

    // Primary (adjusted for dark)
    primary: '#60a5fa',
    primaryHover: '#3b82f6',
    primaryActive: '#2563eb',

    // Secondary (adjusted for dark)
    secondary: '#a78bfa',
    secondaryHover: '#8b5cf6',
    secondaryActive: '#7c3aed',

    // Status (adjusted for dark)
    success: '#34d399',
    warning: '#fbbf24',
    error: '#f87171',
    info: '#60a5fa',

    // Links
    link: '#60a5fa',
    linkHover: '#3b82f6',
    linkDown: '#f87171',

    // Device colors (adjusted for dark)
    devices: {
      [DeviceType.Router]: '#60a5fa',
      [DeviceType.L3Switch]: '#a78bfa',
      [DeviceType.L2Switch]: '#c4b5fd',
      [DeviceType.Firewall]: '#f87171',
      [DeviceType.LoadBalancer]: '#fbbf24',
      [DeviceType.Server]: '#34d399',
      [DeviceType.AccessPoint]: '#22d3ee',
      [DeviceType.Cloud]: '#60a5fa',
      [DeviceType.Internet]: '#818cf8',
      [DeviceType.Generic]: '#64748b',
    },

    // Module colors (adjusted for dark)
    // @deprecated Use zonePresets instead
    modules: {
      core: '#1e3a8a',
      distribution: '#581c87',
      access: '#064e3b',
      dmz: '#7f1d1d',
      cloud: '#312e81',
      default: '#374151',
    },

    // Surface token colors for subgraph rendering (dark mode)
    surfaces: {
      'surface-1': { fill: '#1e293b', stroke: '#475569', text: '#94a3b8' }, // Slate-800
      'surface-2': { fill: '#334155', stroke: '#64748b', text: '#cbd5e1' }, // Slate-700
      'surface-3': { fill: '#475569', stroke: '#94a3b8', text: '#e2e8f0' }, // Slate-600
      'accent-blue': { fill: '#1e3a8a', stroke: '#3b82f6', text: '#93c5fd' }, // Blue
      'accent-green': { fill: '#064e3b', stroke: '#10b981', text: '#6ee7b7' }, // Green
      'accent-red': { fill: '#4c0519', stroke: '#f43f5e', text: '#fda4af' }, // Rose
      'accent-amber': { fill: '#78350f', stroke: '#f59e0b', text: '#fcd34d' }, // Amber
      'accent-purple': { fill: '#3b0764', stroke: '#a855f7', text: '#d8b4fe' }, // Purple
    },

    // Grid
    grid: '#334155',
    guideline: '#60a5fa',
  },

  shadows: {
    ...lightTheme.shadows,

    // Darker shadows for dark theme
    small: {
      color: '#000000',
      blur: 4,
      offsetX: 0,
      offsetY: 1,
      alpha: 0.3,
    },
    medium: {
      color: '#000000',
      blur: 10,
      offsetX: 0,
      offsetY: 4,
      alpha: 0.4,
    },
    large: {
      color: '#000000',
      blur: 25,
      offsetX: 0,
      offsetY: 10,
      alpha: 0.5,
    },
    glow: {
      color: '#60a5fa',
      blur: 20,
      offsetX: 0,
      offsetY: 0,
      alpha: 0.7,
    },
  },
}
