export const siteName = 'Shumoku Docs'

export function pageTitle(title: string, isHome = false): string {
  return isHome || title === siteName ? siteName : `${title} · ${siteName}`
}
