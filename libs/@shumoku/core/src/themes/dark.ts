// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

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

    // Group surfaces by depth, in OKLCH: a faint grey a little darker than the background, a step
    // deeper with each depth. Everything drawn on the dark canvas is lighter than it, so a darker
    // well only adds contrast to the wires, ports, status and metrics, and lifts the cards. Held
    // by `surfaces.test.ts`.
    groupSurfaces: [
      { fill: '#0f1217', stroke: '#3e424b', text: '#b1b7c5' }, // L .18
      { fill: '#0a0c11', stroke: '#494d56', text: '#b7becb' }, // L .155
      { fill: '#06070a', stroke: '#545861', text: '#bec4d2' }, // L .13
    ],
    // Groups told apart: one hue per top-level group, a tint as faint as the neutrals above
    groupTone: {
      hue: 255,
      fill: { lightness: [0.18, 0.148, 0.116], chroma: 0.0215 },
      stroke: { lightness: [0.4, 0.44, 0.48], chroma: 0.07 },
      text: { lightness: 0.84, chroma: 0.07 },
    },

    // Grid
    grid: '#334155',
    guideline: '#60a5fa',

    port: { fill: '#64748b', stroke: '#94a3b8', labelBackground: '#0f172a', labelText: '#ffffff' },
    // Lines told apart (VLANs): from fittingLineTone over the backgrounds above, at the primary's hue
    lineTone: { lightness: 0.75, chroma: 0.125, hue: 255 },
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
