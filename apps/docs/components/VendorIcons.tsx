'use client'

import { useState, useMemo } from 'react'
import { vendorIconSets } from 'shumoku'
import { cn } from '@/lib/cn'

type VendorKey = 'yamaha' | 'aruba' | 'juniper' | 'aws'

const vendorNames: Record<VendorKey, string> = {
  yamaha: 'Yamaha',
  aruba: 'Aruba',
  juniper: 'Juniper',
  aws: 'AWS',
}

const vendorOrder: VendorKey[] = ['yamaha', 'aruba', 'juniper', 'aws']

function IconPreview({ svg, viewBox }: { svg: string; viewBox?: string }) {
  const needsWrapper = !svg.trim().startsWith('<svg')
  const content = needsWrapper
    ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox || '0 0 100 100'}">${svg}</svg>`
    : svg

  return (
    <span
      className="inline-block h-12 w-12 [&>svg]:h-full [&>svg]:w-full"
      dangerouslySetInnerHTML={{ __html: content }}
    />
  )
}

export function VendorIcons() {
  const [search, setSearch] = useState('')
  const [selectedVendor, setSelectedVendor] = useState<VendorKey | 'all'>('all')

  const iconCounts = useMemo(() => {
    const counts: Record<string, number> = { all: 0 }
    for (const vendor of vendorOrder) {
      const icons = vendorIconSets[vendor]
      const count = icons ? Object.keys(icons).length : 0
      counts[vendor] = count
      counts.all += count
    }
    return counts
  }, [])

  const filteredVendors = useMemo(() => {
    const results: { vendor: VendorKey; icons: { id: string; svg: string; viewBox?: string }[] }[] = []

    for (const vendor of vendorOrder) {
      if (selectedVendor !== 'all' && selectedVendor !== vendor) continue

      const icons = vendorIconSets[vendor]
      if (!icons) continue

      const filteredIcons: { id: string; svg: string; viewBox?: string }[] = []
      for (const [id, entry] of Object.entries(icons)) {
        if (search && !id.toLowerCase().includes(search.toLowerCase())) continue
        filteredIcons.push({
          id,
          svg: entry.default,
          viewBox: entry.viewBox,
        })
      }

      if (filteredIcons.length > 0) {
        results.push({ vendor, icons: filteredIcons })
      }
    }

    return results
  }, [search, selectedVendor])

  return (
    <div className="not-prose">
      {/* Stats */}
      <div className={cn(
        'mb-6 rounded-lg p-4',
        'border border-neutral-200 dark:border-neutral-700',
        'bg-neutral-50 dark:bg-neutral-800'
      )}>
        <p className="text-lg">
          <strong>{iconCounts.all}</strong> 個のベンダーアイコンが利用可能
        </p>
        <div className="mt-2 flex gap-4 text-sm text-neutral-600 dark:text-neutral-400">
          {vendorOrder.map((vendor) => (
            <span key={vendor}>
              {vendorNames[vendor]}: {iconCounts[vendor]}
            </span>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <input
          type="text"
          placeholder="Search icons..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={cn(
            'rounded px-3 py-2 text-sm',
            'border border-neutral-300 dark:border-neutral-600',
            'bg-white dark:bg-neutral-800',
            'placeholder:text-neutral-400 dark:placeholder:text-neutral-500',
            'focus:outline-none focus:ring-2 focus:ring-blue-500'
          )}
        />
        <div className="flex flex-wrap gap-2">
          <button
            className={cn(
              'rounded px-3 py-1.5 text-sm transition-colors',
              selectedVendor === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-600'
            )}
            onClick={() => setSelectedVendor('all')}
          >
            All ({iconCounts.all})
          </button>
          {vendorOrder.map((vendor) => (
            <button
              key={vendor}
              className={cn(
                'rounded px-3 py-1.5 text-sm transition-colors',
                selectedVendor === vendor
                  ? 'bg-blue-600 text-white'
                  : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-600'
              )}
              onClick={() => setSelectedVendor(vendor)}
            >
              {vendorNames[vendor]} ({iconCounts[vendor]})
            </button>
          ))}
        </div>
      </div>

      {/* Icons */}
      {filteredVendors.map(({ vendor, icons }) => (
        <section key={vendor} className="mb-8">
          <h3 className="mb-4 text-xl font-semibold">
            {vendorNames[vendor]} ({icons.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className={cn(
                  'border-b border-neutral-200 dark:border-neutral-700',
                  'bg-neutral-50 dark:bg-neutral-800'
                )}>
                  <th className="px-4 py-2 text-left font-medium">model / service</th>
                  <th className="px-4 py-2 text-left font-medium">Icon</th>
                </tr>
              </thead>
              <tbody>
                {icons.map(({ id, svg, viewBox }) => (
                  <tr key={id} className="border-b border-neutral-200 dark:border-neutral-700">
                    <td className="px-4 py-2">
                      <code className={cn(
                        'rounded px-1.5 py-0.5 text-sm',
                        'bg-neutral-100 dark:bg-neutral-800'
                      )}>{id}</code>
                    </td>
                    <td className="px-4 py-2">
                      <IconPreview svg={svg} viewBox={viewBox} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      {filteredVendors.length === 0 && search && (
        <p className="text-neutral-500 dark:text-neutral-400">No icons found for "{search}"</p>
      )}
    </div>
  )
}
