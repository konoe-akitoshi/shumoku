import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared'

const navTitle = (
  <>
    <img src="/logo-symbol.svg" alt="Shumoku" className="h-6 w-6" />
    <span>Shumoku</span>
  </>
)

// For home page and playground
export function baseOptions(locale: string): BaseLayoutProps {
  return {
    nav: {
      title: navTitle,
    },
    links: [
      {
        text: 'Docs',
        url: `/${locale}/docs/server`,
      },
      {
        text: 'Playground',
        url: `/${locale}/playground`,
      },
    ],
    githubUrl: 'https://github.com/konoe-akitoshi/shumoku',
    i18n: true,
  }
}

// For docs pages (no links in sidebar)
export function docsOptions(locale: string): BaseLayoutProps {
  return {
    nav: {
      title: navTitle,
      url: `/${locale}`,
    },
    githubUrl: 'https://github.com/konoe-akitoshi/shumoku',
    i18n: true,
  }
}
