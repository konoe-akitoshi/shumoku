import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
export const cn = (...values: ClassValue[]) => twMerge(clsx(values))
export { docsUrl } from '../site'
export const sectionStyles = {
  title: 'site-section-title',
  subtitle: 'site-section-subtitle',
  padding: 'site-section',
} as const
