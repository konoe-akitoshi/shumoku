import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export type WithoutChildrenOrChild<T> = T extends { children?: unknown; child?: unknown }
  ? Omit<T, 'children' | 'child'>
  : T
