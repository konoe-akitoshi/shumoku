import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
export const cn = (...values: ClassValue[]) => twMerge(clsx(values))
export { docsUrl } from '../site'
export const buttonStyles = {
  primary: ['site-button site-button-primary'],
  primaryLarge: ['site-button site-button-primary'],
  secondary: ['site-button site-button-secondary'],
  secondaryLarge: ['site-button site-button-secondary'],
} as const
export const sectionStyles = {
  title: 'site-section-title',
  subtitle: 'site-section-subtitle',
  padding: 'site-section',
} as const
export const cardStyles = {
  feature: [
    'group p-6 rounded-lg',
    'bg-white dark:bg-neutral-900',
    'border border-neutral-200 dark:border-neutral-800',
  ],
  install: [
    'inline-flex items-center gap-3 px-4 py-2.5 rounded',
    'bg-neutral-950 text-neutral-100',
    'border border-neutral-800',
  ],
} as const
