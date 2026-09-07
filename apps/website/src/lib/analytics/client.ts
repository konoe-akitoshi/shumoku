import * as consent from 'vanilla-cookieconsent'
import 'vanilla-cookieconsent/dist/cookieconsent.css'
import { setGoogleAnalytics } from './google'
import { fetchPolicy, isWebsiteHost, shouldMeasure } from './policy'
import { consentTranslation } from './translations'
import { setVercelAnalytics } from './vercel'

let initialization: Promise<void> | undefined
const currentLanguage = () => (document.documentElement.lang === 'ja' ? 'ja' : 'en')

/** Shared by the idle bootstrap and preferences button, including concurrent calls. */
export function initializeAnalytics() {
  initialization ??= initialize().catch((error: unknown) => {
    initialization = undefined
    throw error
  })
  return initialization
}

async function initialize() {
  const eligible = isWebsiteHost(new URL(window.location.href), import.meta.env.PROD)
  const policy = eligible ? await fetchPolicy(fetch) : { enabled: false, requiresConsent: true }
  const synchronize = () => {
    const saved = consent.validConsent() ? consent.acceptedCategory('analytics') : undefined
    const allowed = shouldMeasure(policy, saved)
    setVercelAnalytics(allowed)
    setGoogleAnalytics(allowed)
  }
  await consent.run({
    revision: 1,
    mode: policy.requiresConsent ? 'opt-in' : 'opt-out',
    autoShow: policy.enabled && policy.requiresConsent,
    disablePageInteraction: false,
    lazyHtmlGeneration: true,
    manageScriptTags: false,
    cookie: { name: 'shumoku_consent', expiresAfterDays: 180 },
    guiOptions: {
      consentModal: { layout: 'box inline', position: 'bottom right', equalWeightButtons: true },
      preferencesModal: { layout: 'box', equalWeightButtons: true },
    },
    categories: {
      necessary: { enabled: true, readOnly: true },
      analytics: { enabled: !policy.requiresConsent },
    },
    language: {
      default: currentLanguage(),
      translations: { en: consentTranslation('en'), ja: consentTranslation('ja') },
    },
    onConsent: synchronize,
    onChange: synchronize,
  })
  synchronize()
}

export async function openAnalyticsPreferences() {
  await initializeAnalytics()
  await consent.setLanguage(currentLanguage())
  consent.showPreferences()
}

export async function setAnalyticsLanguage(locale: 'en' | 'ja') {
  if (initialization) {
    await initialization
    await consent.setLanguage(locale)
  }
}
