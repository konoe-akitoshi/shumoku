import { type BeforeSendEvent, injectAnalytics } from '@vercel/analytics/sveltekit'

let enabled = false
let started = false

export function filterVercelEvent(event: BeforeSendEvent): BeforeSendEvent | null {
  if (!enabled || event.type !== 'pageview') return null
  try {
    const url = new URL(event.url)
    url.search = ''
    url.hash = ''
    return { ...event, url: url.toString() }
  } catch {
    return null
  }
}

/** Called only after the shared production/region/consent policy has been resolved. */
export function setVercelAnalytics(allowed: boolean) {
  enabled = allowed
  if (!allowed || started) return
  injectAnalytics({ mode: 'production', debug: false, beforeSend: filterVercelEvent })
  started = true
}
