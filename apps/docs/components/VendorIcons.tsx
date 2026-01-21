'use client'

import { useMemo, useState } from 'react'
import { cn } from '@/lib/cn'
import {
  type VendorKey,
  getIconUrl,
  vendorConfig,
  vendorIcons,
  vendorOrder,
} from '@/lib/vendor-icons-data'

export function VendorIcons() {
  const [search, setSearch] = useState('')
  const [selectedVendor, setSelectedVendor] = useState<VendorKey | 'all'>('all')

  const iconCounts = useMemo(() => {
    const counts: Record<string, number> = { all: 0 }
    for (const vendor of vendorOrder) {
      const count = vendorIcons[vendor].length
      counts[vendor] = count
      counts.all += count
    }
    return counts
  }, [])

  const filteredVendors = useMemo(() => {
    const results: { vendor: VendorKey; icons: { id: string; url: string }[] }[] = []

    for (const vendor of vendorOrder) {
      if (selectedVendor !== 'all' && selectedVendor !== vendor) continue

      const icons = vendorIcons[vendor]
      const filteredIcons: { id: string; url: string }[] = []

      for (const id of icons) {
        if (search && !id.toLowerCase().includes(search.toLowerCase())) continue
        filteredIcons.push({
          id,
          url: getIconUrl(vendor, id),
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
      <div
        className={cn(
          'mb-6 rounded-lg p-4',
          'border border-neutral-200 dark:border-neutral-700',
          'bg-neutral-50 dark:bg-neutral-800',
        )}
      >
        <p className="text-lg">
          <strong>{iconCounts.all}</strong> vendor icons available
        </p>
        <div className="mt-2 flex gap-4 text-sm text-neutral-600 dark:text-neutral-400">
          {vendorOrder.map((vendor) => (
            <span key={vendor}>
              {vendorConfig[vendor].name}: {iconCounts[vendor]}
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
            'focus:outline-none focus:ring-2 focus:ring-blue-500',
          )}
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={cn(
              'rounded px-3 py-1.5 text-sm transition-colors',
              selectedVendor === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-600',
            )}
            onClick={() => setSelectedVendor('all')}
          >
            All ({iconCounts.all})
          </button>
          {vendorOrder.map((vendor) => (
            <button
              type="button"
              key={vendor}
              className={cn(
                'rounded px-3 py-1.5 text-sm transition-colors',
                selectedVendor === vendor
                  ? 'bg-blue-600 text-white'
                  : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-600',
              )}
              onClick={() => setSelectedVendor(vendor)}
            >
              {vendorConfig[vendor].name} ({iconCounts[vendor]})
            </button>
          ))}
        </div>
      </div>

      {/* Icons */}
      {filteredVendors.map(({ vendor, icons }) => (
        <section key={vendor} className="mb-8">
          <h3 className="mb-4 text-xl font-semibold">
            {vendorConfig[vendor].name} ({icons.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr
                  className={cn(
                    'border-b border-neutral-200 dark:border-neutral-700',
                    'bg-neutral-50 dark:bg-neutral-800',
                  )}
                >
                  <th className="px-4 py-2 text-left font-medium">model / service</th>
                  <th className="px-4 py-2 text-left font-medium">Icon</th>
                </tr>
              </thead>
              <tbody>
                {icons.map(({ id, url }) => (
                  <tr key={id} className="border-b border-neutral-200 dark:border-neutral-700">
                    <td className="px-4 py-2">
                      <code
                        className={cn(
                          'rounded px-1.5 py-0.5 text-sm',
                          'bg-neutral-100 dark:bg-neutral-800',
                        )}
                      >
                        {id}
                      </code>
                    </td>
                    <td className="px-4 py-2">
                      <img
                        src={url}
                        alt={id}
                        className="h-12 w-12 object-contain"
                        loading="lazy"
                      />
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
