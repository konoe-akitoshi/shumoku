import { readFile, writeFile } from 'node:fs/promises'

type ProductName = 'server' | 'editor'

interface ProductConfig {
  packagePath: string
  workspacePath: string
  chartPath?: string
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

  await updateLockfile(config.workspacePath, version)
  await checkProduct(product)
}

const product = getProduct(Bun.argv[2])
const argument = Bun.argv[3]

if (argument === '--check') {
  await checkProduct(product)
} else if (argument) {
  await setProductVersion(product, argument.replace(/^(?:server|editor)-v/, ''))
} else {
  throw new Error('Usage: bun scripts/product-version.ts <server|editor> <X.Y.Z[-beta.N]|--check>')
}
