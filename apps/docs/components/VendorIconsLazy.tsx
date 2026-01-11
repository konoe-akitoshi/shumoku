'use client'

import dynamic from 'next/dynamic'
import { cn } from '@/lib/cn'

const VendorIconsComponent = dynamic(
  () => import('./VendorIcons').then((mod) => ({ default: mod.VendorIcons })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className={cn(
            'inline-block h-8 w-8 animate-spin rounded-full',
            'border-4 border-solid border-current border-r-transparent',
            'text-emerald-500'
          )} />
          <p className="mt-4 text-neutral-500 dark:text-neutral-400">Loading icons...</p>
        </div>
      </div>
    ),
  }
)

export function VendorIconsLazy() {
  return <VendorIconsComponent />
}
