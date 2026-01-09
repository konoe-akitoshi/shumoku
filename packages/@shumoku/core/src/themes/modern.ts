/**
 * Modern theme - Default light theme
 */

import type { Theme } from './types'
import { DeviceType } from '../models'

export const modernTheme: Theme = {
  name: 'modern',
  variant: 'light',
  
  colors: {
    // Backgrounds
    background: '#ffffff',
    surface: '#f8fafc',
    surfaceHover: '#f1f5f9',
    
    // Text
    text: '#0f172a',
    textSecondary: '#64748b',
    textDisabled: '#cbd5e1',
    
    // Primary (Blue)
    primary: '#3b82f6',
    primaryHover: '#2563eb',
    primaryActive: '#1d4ed8',
    
    // Secondary (Purple)
    secondary: '#8b5cf6',
    secondaryHover: '#7c3aed',
    secondaryActive: '#6d28d9',
    
    // Status
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
    
    // Links
    link: '#3b82f6',
    linkHover: '#2563eb',
    linkDown: '#ef4444',
    
    // Device colors
    devices: {
      [DeviceType.Router]: '#3b82f6',
      [DeviceType.L3Switch]: '#8b5cf6',
      [DeviceType.L2Switch]: '#a78bfa',
      [DeviceType.Firewall]: '#ef4444',
      [DeviceType.LoadBalancer]: '#f59e0b',
      [DeviceType.Server]: '#10b981',
      [DeviceType.AccessPoint]: '#06b6d4',
      [DeviceType.Cloud]: '#3b82f6',
      [DeviceType.Internet]: '#6366f1',
      [DeviceType.Generic]: '#94a3b8',
    },
    
    // Module colors
    modules: {
      core: '#dbeafe',
      distribution: '#e9d5ff',
      access: '#d1fae5',
      dmz: '#fee2e2',
      cloud: '#e0e7ff',
      default: '#f3f4f6',
    },
    
    // Grid
    grid: '#e5e7eb',
    guideline: '#3b82f6',
  },
  
  dimensions: {
    device: {
      small: { width: 60, height: 40 },
      medium: { width: 80, height: 60 },
      large: { width: 120, height: 80 },
    },
    
    fontSize: {
      tiny: 10,
      small: 12,
      medium: 14,
      large: 16,
      huge: 20,
    },
    
    lineWidth: {
      thin: 1,
      normal: 2,
      thick: 3,
      emphasis: 4,
    },
    
    spacing: {
      xs: 4,
      sm: 8,
      md: 16,
      lg: 24,
      xl: 32,
    },
    
    radius: {
      small: 4,
      medium: 8,
      large: 12,
      round: 9999,
    },
  },
  
  shadows: {
    none: {
      color: 'transparent',
      blur: 0,
      offsetX: 0,
      offsetY: 0,
    },
    small: {
      color: '#0f172a',
      blur: 4,
      offsetX: 0,
      offsetY: 1,
      alpha: 0.05,
    },
    medium: {
      color: '#0f172a',
      blur: 10,
      offsetX: 0,
      offsetY: 4,
      alpha: 0.1,
    },
    large: {
      color: '#0f172a',
      blur: 25,
      offsetX: 0,
      offsetY: 10,
      alpha: 0.15,
    },
    glow: {
      color: '#3b82f6',
      blur: 20,
      offsetX: 0,
      offsetY: 0,
      alpha: 0.5,
    },
  },
  
  animations: {
    duration: {
      instant: 0,
      fast: 150,
      normal: 300,
      slow: 500,
    },
    
    easing: {
      linear: 'linear',
      easeIn: 'ease-in',
      easeOut: 'ease-out',
      easeInOut: 'ease-in-out',
      bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    },
  },
  
  typography: {
    fontFamily: {
      sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      mono: 'ui-monospace, "Cascadia Mono", "Consolas", monospace',
      display: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    },
    
    fontWeight: {
      light: 300,
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    
    letterSpacing: {
      tight: -0.025,
      normal: 0,
      wide: 0.025,
    },
  },
}