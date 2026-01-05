/**
 * Dark theme
 */

import type { Theme } from './types'
import { modernTheme } from './modern'
import { DeviceType } from '../models'

export const darkTheme: Theme = {
  ...modernTheme,
  name: 'dark',
  variant: 'dark',
  
  colors: {
    ...modernTheme.colors,
    
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
      [DeviceType.Unknown]: '#64748b',
    },
    
    // Module colors (adjusted for dark)
    modules: {
      core: '#1e3a8a',
      distribution: '#581c87',
      access: '#064e3b',
      dmz: '#7f1d1d',
      cloud: '#312e81',
      default: '#374151',
    },
    
    // Grid
    grid: '#334155',
    guideline: '#60a5fa',
  },
  
  shadows: {
    ...modernTheme.shadows,
    
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