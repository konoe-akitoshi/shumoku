import { type ClassValue, clsx } from 'clsx'

export type ControlVariant = 'primary' | 'secondary' | 'ghost'
export type ControlSize = 'default' | 'large' | 'icon' | 'compact'

export function controlClass(
  variant: ControlVariant = 'secondary',
  size: ControlSize = 'default',
  className?: ClassValue,
) {
  return clsx('ui-control', `ui-control--${variant}`, `ui-control--${size}`, className)
}
