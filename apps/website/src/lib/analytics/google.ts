import { measurementId } from './policy'

type GoogleWindow = Window & {
  dataLayer?: unknown[]
  gtag?: (...args: unknown[]) => void
  'ga-disable-G-SHX2VE8F8F'?: boolean
}

let started = false

/** Called only after production and consent gates pass. No module-level network activity. */
export function setGoogleAnalytics(allowed: boolean) {
  const target = window as GoogleWindow
  target['ga-disable-G-SHX2VE8F8F'] = !allowed
  if (!allowed) {
    for (const name of ['_ga', '_ga_SHX2VE8F8F']) {
      // biome-ignore lint/suspicious/noDocumentCookie: synchronous host-only cookie removal before reload, including browsers without Cookie Store
      document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax; Secure`
    }
    // Remove Google's installed history listeners as well as its cookies on withdrawal.
    // The consent library saves the rejection before invoking this callback.
    if (started) window.location.reload()
    return
  }
  if (started) return
  started = true
  const queue = target.dataLayer ?? []
  target.dataLayer = queue
  target.gtag = function (..._args: unknown[]) {
    // biome-ignore lint/complexity/noArguments: gtag's documented dataLayer command protocol uses an Arguments object
    queue.push(arguments)
  }
  target.gtag('consent', 'default', {
    analytics_storage: 'granted',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  })
  target.gtag('js', new Date())
  // One page-view owner: GA4 Enhanced Measurement (including History API changes).
  target.gtag('config', measurementId, {
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    cookie_domain: 'none',
    cookie_expires: 60 * 60 * 24 * 180,
    cookie_update: false,
  })
  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`
  document.head.append(script)
}
