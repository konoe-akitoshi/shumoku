import { createHash } from 'node:crypto'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

type Locale = 'en' | 'ja'

interface GuideMetadata {
  id: string
  title: string
  description: string
  locale: Locale
  canonicalLocale: Locale
  slug: string
  status: string
  audience: string
  owner: string
  journey: string
  journeyFile: string
  canonicalDigest?: string
  related: string[]
}

interface GuideSource extends GuideMetadata {
  file: string
  canonicalDigest: string
}

interface JourneyStep {
  action: string
  anchor?: string
  value?: string
}

interface Journey {
  id: string
  source: string
  steps: JourneyStep[]
}

const toolingDirectory = path.dirname(fileURLToPath(import.meta.url))
const repositoryRoot = path.resolve(toolingDirectory, '../../..')
const guidesRoot = path.join(repositoryRoot, 'apps')
const outputPath = path.join(repositoryRoot, 'apps/docs/.generated/guides.json')

async function collectGuides(directory: string): Promise<string[]> {
  const files: string[] = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...(await collectGuides(entryPath)))
    else if (entry.isFile() && /\.guide\.(en|ja)\.md$/.test(entry.name)) files.push(entryPath)
  }
  return files
}

function parseFrontmatter(
  contents: string,
  file: string,
): { metadata: GuideMetadata; body: string } {
  const match = contents.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) throw new Error(`${file}: guide must contain YAML frontmatter`)
  const frontmatter = match[1]
  const body = match[2]
  if (frontmatter === undefined || body === undefined) throw new Error(`${file}: invalid guide`)

  const values = new Map<string, string>()
  const lists = new Map<string, string[]>()
  let activeList: string | undefined
  for (const line of frontmatter.split('\n')) {
    const listItem = line.match(/^\s+-\s+(.+)$/)
    if (listItem && activeList) {
      lists.get(activeList)?.push(listItem[1] ?? '')
      continue
    }
    const field = line.match(/^([A-Za-z][A-Za-z0-9]*):\s*(.*)$/)
    if (!field) throw new Error(`${file}: unsupported frontmatter line: ${line}`)
    const key = field[1]
    const value = field[2]
    if (!key || value === undefined) continue
    if (value === '') {
      activeList = key
      lists.set(key, [])
    } else {
      activeList = undefined
      values.set(key, value)
    }
  }

  function required(key: string): string {
    const value = values.get(key)
    if (!value) throw new Error(`${file}: missing ${key}`)
    return value
  }

  const locale = required('locale')
  const canonicalLocale = required('canonicalLocale')
  if (
    (locale !== 'en' && locale !== 'ja') ||
    (canonicalLocale !== 'en' && canonicalLocale !== 'ja')
  ) {
    throw new Error(`${file}: locale and canonicalLocale must be en or ja`)
  }
  return {
    metadata: {
      id: required('id'),
      title: required('title'),
      description: required('description'),
      locale,
      canonicalLocale,
      slug: required('slug'),
      status: required('status'),
      audience: required('audience'),
      owner: required('owner'),
      journey: required('journey'),
      journeyFile: required('journeyFile'),
      ...(values.get('canonicalDigest') ? { canonicalDigest: required('canonicalDigest') } : {}),
      related: lists.get('related') ?? [],
    },
    body,
  }
}

function digest(contents: string): string {
  return createHash('sha256').update(contents).digest('hex')
}

function asJourney(value: unknown, context: string): Journey {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${context}: journey export must be an object`)
  }
  const journey = value as Record<string, unknown>
  if (
    typeof journey['id'] !== 'string' ||
    typeof journey['source'] !== 'string' ||
    !Array.isArray(journey['steps'])
  ) {
    throw new Error(`${context}: journey is missing id, source, or steps`)
  }
  return journey as unknown as Journey
}

const parsedGuides = await Promise.all(
  (await collectGuides(guidesRoot)).sort().map(async (file) => {
    const parsed = parseFrontmatter(
      await readFile(file, 'utf8'),
      path.relative(repositoryRoot, file),
    )
    return { ...parsed, file: path.relative(repositoryRoot, file) }
  }),
)

const groups = new Map<string, typeof parsedGuides>()
for (const guide of parsedGuides) {
  const key = `${guide.metadata.id}:${guide.metadata.slug}`
  const group = groups.get(key) ?? []
  if (group.some(({ metadata }) => metadata.locale === guide.metadata.locale)) {
    throw new Error(
      `${guide.file}: duplicate ${guide.metadata.locale} guide for ${guide.metadata.id}`,
    )
  }
  group.push(guide)
  groups.set(key, group)
}

const guides: GuideSource[] = []
for (const [key, group] of groups) {
  const canonicalLocale = group[0]?.metadata.canonicalLocale
  const canonical = group.find(({ metadata }) => metadata.locale === canonicalLocale)
  if (!canonical) throw new Error(`${key}: missing canonical ${canonicalLocale} guide`)
  const canonicalDigest = digest(canonical.body)

  for (const guide of group) {
    if (guide.metadata.canonicalLocale !== canonicalLocale) {
      throw new Error(`${guide.file}: canonicalLocale differs within ${key}`)
    }
    if (
      guide.metadata.locale !== canonicalLocale &&
      guide.metadata.canonicalDigest !== canonicalDigest
    ) {
      throw new Error(
        `${guide.file}: translation is stale; set canonicalDigest to ${canonicalDigest} after review`,
      )
    }

    const journeyPath = path.join(repositoryRoot, guide.metadata.journeyFile)
    const journeyModule = (await import(pathToFileURL(journeyPath).href)) as Record<string, unknown>
    const journey = asJourney(journeyModule[guide.metadata.journey], guide.file)
    if (journey.id !== guide.metadata.id) {
      throw new Error(`${guide.file}: guide id and journey id differ`)
    }
    const source = await readFile(path.join(repositoryRoot, journey.source), 'utf8')
    for (const step of journey.steps) {
      if (step.anchor && !source.includes(`data-doc-step="${step.anchor}"`)) {
        throw new Error(
          `${guide.file}: journey anchor ${step.anchor} is missing from ${journey.source}`,
        )
      }
    }

    guides.push({
      ...guide.metadata,
      file: guide.file,
      canonicalDigest,
    })
  }
}

await writeFile(outputPath, `${JSON.stringify({ schemaVersion: 1, guides }, null, 2)}\n`)
console.log(
  `[docs] generated ${path.relative(repositoryRoot, outputPath)} (${guides.length} localized guides)`,
)
