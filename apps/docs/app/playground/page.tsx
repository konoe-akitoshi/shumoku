'use client'

import dynamic from 'next/dynamic'
import { cn } from '@/lib/cn'

const PlaygroundClient = dynamic(() => import('./PlaygroundClient'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[calc(100vh-64px)] items-center justify-center">
      <div className="text-center">
        <div className={cn(
          'inline-block h-8 w-8 animate-spin rounded-full',
          'border-4 border-solid border-current border-r-transparent',
          'text-emerald-500'
        )} />
        <p className="mt-4 text-neutral-500 dark:text-neutral-400">Loading Playground...</p>
      </div>
    </div>
  ),
})

export default function PlaygroundPage() {
  return <PlaygroundClient />
}
