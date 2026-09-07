export const measurementId = 'G-SHX2VE8F8F'
export interface AnalyticsPolicy {
  enabled: boolean
  requiresConsent: boolean
}

export function isWebsiteHost(url: URL, productionBuild: boolean): boolean {
  return (
    productionBuild &&
    url.protocol === 'https:' &&
    ['www.shumoku.dev', 'shumoku.dev'].includes(url.hostname)
  )
}

/** JP is the only opt-out jurisdiction configured; unknown locations fail closed. */
export function analyticsPolicy(country: string | null, production: boolean): AnalyticsPolicy {
  return { enabled: production, requiresConsent: country !== 'JP' }
}

export function shouldMeasure(policy: AnalyticsPolicy, savedChoice: boolean | undefined) {
  return policy.enabled && (savedChoice ?? !policy.requiresConsent)
}

export async function fetchPolicy(fetcher: typeof fetch): Promise<AnalyticsPolicy> {
  try {
    const response = await fetcher('/api/analytics-policy', {
      cache: 'no-store',
      signal: AbortSignal.timeout(1500),
    })
    if (!response.ok) throw new Error('Policy unavailable')
    const value: unknown = await response.json()
    if (
      !value ||
      typeof value !== 'object' ||
      !('enabled' in value) ||
      typeof value.enabled !== 'boolean' ||
      !('requiresConsent' in value) ||
      typeof value.requiresConsent !== 'boolean'
    ) {
      throw new Error('Invalid policy')
    }
    return { enabled: value.enabled, requiresConsent: value.requiresConsent }
  } catch {
    return { enabled: false, requiresConsent: true }
  }
}
