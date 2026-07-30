import { readFile, writeFile } from 'node:fs/promises'

type ProductName = 'server' | 'editor'

interface ProductConfig {
  packagePath: string
  workspacePath: string
  chartPath?: string
  documentation?: DocumentationConfig[]
}

interface DocumentationConfig {
  path: string
  versionPatterns: RegExp[]
}

interface PackageManifest {
  version?: string
  [key: string]: unknown
}

interface BunLockfile {
  workspaces?: Record<string, PackageManifest>
}

const products: Record<ProductName, ProductConfig> = {
  server: {
    packagePath: 'apps/server/package.json',
    workspacePath: 'apps/server',
    chartPath: 'apps/server/chart/shumoku/Chart.yaml',
    documentation: [
      {
        path: 'apps/server/README.md',
        versionPatterns: [
          /(?<prefix>SHUMOKU_VERSION=)(?<version>\d+\.\d+\.\d+(?:-beta\.\d+)?)/g,
          /(?<prefix>ghcr\.io\/konoe-akitoshi\/shumoku:)(?<version>\d+\.\d+\.\d+(?:-beta\.\d+)?)/g,
          /(?<prefix>--version\s+)(?<version>\d+\.\d+\.\d+(?:-beta\.\d+)?)/g,
        ],
      },
      {
        path: 'apps/server/docs/helm-chart.md',
        versionPatterns: [
          /(?<prefix>--version\s+)(?<version>\d+\.\d+\.\d+(?:-beta\.\d+)?)/g,
          /(?<prefix>image\.tag=)(?<version>\d+\.\d+\.\d+(?:-beta\.\d+)?)/g,
        ],
      },
    ],
  },
  editor: {
    packagePath: 'apps/editor/package.json',
    workspacePath: 'apps/editor',
  },
}

const versionPattern = /^\d+\.\d+\.\d+(?:-beta\.\d+)?$/

function getProduct(value: string | undefined): ProductName {
  if (value === 'server' || value === 'editor') return value
  throw new Error('Product must be "server" or "editor"')
}

async function readProductVersion(config: ProductConfig): Promise<string> {
  const manifest = JSON.parse(await readFile(config.packagePath, 'utf8')) as PackageManifest
  if (!manifest.version) {
    throw new Error(`${config.packagePath} does not contain a version`)
  }
  return manifest.version
}

async function readChartVersions(
  chartPath: string,
): Promise<{ version: string; appVersion: string }> {
  const chart = await readFile(chartPath, 'utf8')
  const version = chart.match(/^version:\s*["']?([^"'\s]+)["']?\s*$/m)?.[1]
  const appVersion = chart.match(/^appVersion:\s*["']?([^"'\s]+)["']?\s*$/m)?.[1]
  if (!version || !appVersion) {
    throw new Error(`${chartPath} must contain version and appVersion`)
  }
  return { version, appVersion }
}

async function readLockVersion(workspacePath: string): Promise<string | undefined> {
  if (!(await Bun.file('bun.lock').exists())) return undefined

  const lockfile = Bun.JSONC.parse(await readFile('bun.lock', 'utf8')) as BunLockfile
  const version = lockfile.workspaces?.[workspacePath]?.version
  if (!version) {
    throw new Error(`bun.lock does not contain a version for ${workspacePath}`)
  }
  return version
}

async function readDocumentationVersions(
  documentation: DocumentationConfig[],
): Promise<Map<string, string>> {
  const versions = new Map<string, string>()

  for (const document of documentation) {
    const content = await readFile(document.path, 'utf8')
    for (const pattern of document.versionPatterns) {
      const matches = [...content.matchAll(pattern)]
      if (matches.length === 0) {
        continue
      }
      for (const [index, match] of matches.entries()) {
        const version = match.groups?.version
        if (!version) {
          // version groupを定義し忘れない限りここには来ないはず
          throw new Error('version pattern must include a named "version" group')
        }
        versions.set(`${document.path}#${pattern.source}:${index + 1}`, version)
      }
    }
  }

  return versions
}

async function checkProduct(product: ProductName): Promise<void> {
  const config = products[product]
  const expected = await readProductVersion(config)
  const versions = new Map<string, string | undefined>([
    [config.packagePath, expected],
    [`bun.lock#${config.workspacePath}`, await readLockVersion(config.workspacePath)],
  ])

  if (config.chartPath) {
    const chart = await readChartVersions(config.chartPath)
    versions.set(`${config.chartPath}#version`, chart.version)
    versions.set(`${config.chartPath}#appVersion`, chart.appVersion)
  }
  if (config.documentation) {
    for (const [reference, version] of await readDocumentationVersions(config.documentation)) {
      versions.set(reference, version)
    }
  }

  const mismatches = [...versions].filter(([, version]) => version && version !== expected)
  if (mismatches.length > 0) {
    for (const [path, version] of versions) {
      console.error(`${path}: ${version ?? 'not present'}`)
    }
    throw new Error(`Shumoku ${product} versions are not synchronized`)
  }

  console.log(`Shumoku ${product} version: ${expected}`)
}

async function updateLockfile(workspacePath: string, version: string): Promise<void> {
  if (!(await Bun.file('bun.lock').exists())) return

  const lines = (await readFile('bun.lock', 'utf8')).split('\n')
  let inWorkspace = false
  let updated = false

  for (const [index, line] of lines.entries()) {
    const workspaceMatch = line.match(/^ {4}"([^"]+)": \{$/)
    if (workspaceMatch?.[1]) {
      inWorkspace = workspaceMatch[1] === workspacePath
      continue
    }
    if (inWorkspace && /^ {6}"version": "[^"]+",$/.test(line)) {
      lines[index] = `      "version": "${version}",`
      updated = true
      break
    }
  }

  if (!updated) {
    throw new Error(`Failed to update bun.lock workspace ${workspacePath}`)
  }
  await writeFile('bun.lock', lines.join('\n'))
}

async function setProductVersion(product: ProductName, version: string): Promise<void> {
  if (!versionPattern.test(version)) {
    throw new Error(`Invalid version: ${version}. Expected X.Y.Z or X.Y.Z-beta.N`)
  }

  const config = products[product]
  const manifest = JSON.parse(await readFile(config.packagePath, 'utf8')) as PackageManifest
  manifest.version = version
  await writeFile(config.packagePath, `${JSON.stringify(manifest, null, 2)}\n`)

  if (config.chartPath) {
    const chart = await readFile(config.chartPath, 'utf8')
    const updatedChart = chart
      .replace(/^version:\s*["']?[^"'\s]+["']?\s*$/m, `version: ${version}`)
      .replace(/^appVersion:\s*["']?[^"'\s]+["']?\s*$/m, `appVersion: "${version}"`)
    await writeFile(config.chartPath, updatedChart)
  }

  for (const document of config.documentation ?? []) {
    let content = await readFile(document.path, 'utf8')
    for (const pattern of document.versionPatterns) {
      content = content.replace(pattern, `$<prefix>${version}`)
    }
    await writeFile(document.path, content)
  }

  await updateLockfile(config.workspacePath, version)
  await checkProduct(product)
}

async function checkReleaseTag(product: ProductName, tag: string): Promise<void> {
  await checkProduct(product)
  const version = await readProductVersion(products[product])
  const expectedTag = `${product}-v${version}`
  if (tag !== expectedTag) {
    throw new Error(`${product} release tag must be ${expectedTag}, received ${tag}`)
  }
}

const product = getProduct(Bun.argv[2])
const argument = Bun.argv[3]
const releaseTag = Bun.argv[4]

if (argument === '--check') {
  await checkProduct(product)
} else if (argument === '--check-release') {
  if (!releaseTag) throw new Error('Release tag is required')
  await checkReleaseTag(product, releaseTag)
} else if (argument) {
  await setProductVersion(product, argument.replace(/^(?:server|editor)-v/, ''))
} else {
  throw new Error(
    'Usage: bun scripts/product-version.ts <server|editor> <X.Y.Z[-beta.N]|--check|--check-release TAG>',
  )
}
