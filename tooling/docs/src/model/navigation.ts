import type { RepositoryDocsModel, ServerDocsArtifact } from './docs-model'
// Shared by release artifact generation and site rendering.
import { localizedPage, repositoryPagePath } from './repository-docs'
import { guideRouteSlug, localizedGuides } from './server-version'

export interface DocsNavigationLink {
  label: string
  href: string
}

export interface DocsNavigationGroup {
  label: string
  links: DocsNavigationLink[]
}

export interface DocsSection extends DocsNavigationLink {
  id: 'overview' | 'library' | 'cli' | 'server'
  pathPrefixes: string[]
}

const libraryPackagePages = [
  'library-packages',
  'library-core',
  'library-catalog',
  'library-plugin-sdk',
  'library-renderer',
  'library-renderer-svg',
  'library-renderer-html',
  'library-renderer-png',
]

const serverRepositoryPages = [
  'server-overview',
  'server-database',
  'server-helm',
  'server-grafana',
  'server-zabbix',
  'server-topology-rendering',
]

const projectGroups = [
  {
    label: { en: 'About', ja: 'Shumokuについて' },
    ids: ['project-philosophy', 'project-origin'],
  },
  {
    label: { en: 'Developers', ja: '開発者向け' },
    ids: ['project-architecture', 'project-plugin-authoring'],
  },
  {
    label: { en: 'Community', ja: 'コミュニティ' },
    ids: ['project-contributing', 'project-support', 'project-commercial-support'],
  },
]

const navigatedRepositoryPages = new Set([
  'project-overview',
  'library-overview',
  'library-examples',
  ...libraryPackagePages,
  'cli-overview',
  ...projectGroups.flatMap(({ ids }) => ids),
  ...serverRepositoryPages,
])

function repositoryLinks(
  model: RepositoryDocsModel,
  ids: string[],
  lang: 'en' | 'ja',
  serverVersion?: string,
): DocsNavigationLink[] {
  return ids.flatMap((id) => {
    const page = model.pages.find((candidate) => candidate.id === id)
    if (!page || page.publication !== 'public') return []
    return [
      {
        label: localizedPage(page, lang).title,
        href: repositoryPagePath(page, lang, serverVersion),
      },
    ]
  })
}

function labels(lang: 'en' | 'ja') {
  return lang === 'en'
    ? {
        start: 'Start here',
        library: 'Library',
        packages: 'Packages',
        reference: 'Reference',
        cli: 'CLI',
        server: 'Server',
        install: 'Install & operate',
        use: 'Use the Server',
        integrations: 'Integrations',
      }
    : {
        start: 'はじめに',
        library: 'ライブラリ',
        packages: 'パッケージ',
        reference: 'リファレンス',
        cli: 'CLI',
        server: 'Server',
        install: '導入と運用',
        use: 'Serverを使う',
        integrations: '連携',
      }
}

export function docsSections(lang: 'en' | 'ja', serverEntry: string): DocsSection[] {
  const text = labels(lang)
  return [
    {
      id: 'overview',
      label: lang === 'en' ? 'Overview' : '概要',
      href: `/${lang}/overview`,
      pathPrefixes: [
        `/${lang}/overview`,
        `/${lang}/getting-started`,
        `/${lang}/about`,
        `/${lang}/developers`,
        `/${lang}/community`,
        `/${lang}/project`,
      ],
    },
    {
      id: 'library',
      label: text.library,
      href: `/${lang}/library`,
      pathPrefixes: [`/${lang}/library`],
    },
    { id: 'cli', label: text.cli, href: `/${lang}/cli`, pathPrefixes: [`/${lang}/cli`] },
    {
      id: 'server',
      label: text.server,
      href: serverEntry,
      pathPrefixes: [`/${lang}/server`],
    },
  ]
}

export function docsNavigation(
  pathname: string,
  lang: 'en' | 'ja',
  repository: RepositoryDocsModel,
  serverArtifact?: ServerDocsArtifact,
): DocsNavigationGroup[] {
  for (const page of repository.pages) {
    if (page.publication === 'public' && !navigatedRepositoryPages.has(page.id)) {
      throw new Error(
        `Public repository page ${page.id} has no navigation placement; add it to navigation.ts or mark it unlisted`,
      )
    }
  }
  const text = labels(lang)
  if (pathname.startsWith(`/${lang}/library`)) {
    return [
      {
        label: text.library,
        links: [
          { label: text.library, href: `/${lang}/library` },
          { label: 'Topology YAML', href: `/${lang}/library/yaml` },
          ...repositoryLinks(repository, ['library-examples'], lang),
        ],
      },
      {
        label: text.packages,
        links: repositoryLinks(repository, libraryPackagePages, lang),
      },
      {
        label: text.reference,
        links: [{ label: 'TypeScript API', href: `/${lang}/library/api` }],
      },
    ]
  }

  if (pathname.startsWith(`/${lang}/cli`)) {
    return [
      {
        label: text.cli,
        links: [
          { label: 'Shumoku CLI', href: `/${lang}/cli` },
          {
            label: lang === 'en' ? 'Command reference' : 'コマンドリファレンス',
            href: `/${lang}/cli/commands/render`,
          },
        ],
      },
    ]
  }

  if (pathname.startsWith(`/${lang}/server`) && serverArtifact) {
    if (serverArtifact.navigation) return serverArtifact.navigation[lang]
    const base = `/${lang}/server/${serverArtifact.release.version}`
    const versionedRepository: RepositoryDocsModel = {
      ...repository,
      pages: [
        ...repository.pages.filter(({ owner }) => owner !== 'server'),
        ...serverArtifact.pages,
      ],
    }
    const guides = localizedGuides(serverArtifact, lang)
    const guideLinks = (ids: string[]) =>
      ids.flatMap((id) => {
        const guide = guides.find((candidate) => candidate.id === id)
        return guide
          ? [{ label: guide.title, href: `${base}/guides/${guideRouteSlug(guide)}` }]
          : []
      })
    return [
      {
        label: text.server,
        links: [{ label: text.server, href: base }],
      },
      {
        label: text.install,
        links: [
          ...guideLinks(['server.installation']),
          ...repositoryLinks(
            versionedRepository,
            ['server-helm'],
            lang,
            serverArtifact.release.version,
          ),
        ],
      },
      {
        label: text.use,
        links: guideLinks([
          'server.topologies.create',
          'server.datasources.create',
          'server.dashboards.create',
        ]),
      },
      {
        label: text.integrations,
        links: [
          ...repositoryLinks(
            versionedRepository,
            ['server-grafana', 'server-zabbix'],
            lang,
            serverArtifact.release.version,
          ),
          ...guideLinks(['server.api-access']),
        ],
      },
      {
        label: text.reference,
        links: [
          { label: 'Server API', href: `${base}/api` },
          { label: 'Data sources', href: `${base}/plugins` },
          ...repositoryLinks(
            versionedRepository,
            ['server-database', 'server-topology-rendering'],
            lang,
            serverArtifact.release.version,
          ),
        ],
      },
    ]
  }

  return [
    {
      label: lang === 'en' ? 'Overview' : '概要',
      links: [
        ...repositoryLinks(repository, ['project-overview'], lang),
        { label: text.start, href: `/${lang}/getting-started` },
      ],
    },
    ...projectGroups.map((group) => ({
      label: group.label[lang],
      links: repositoryLinks(repository, group.ids, lang),
    })),
  ]
}
