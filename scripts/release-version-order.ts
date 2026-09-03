export interface ProductReleaseVersion {
  core: [number, number, number]
  beta?: number
  tag: string
}

const releaseTagPattern = /^(server|editor)-v(\d+)\.(\d+)\.(\d+)(?:-beta\.(\d+))?$/

export function parseProductReleaseTag(tag: string): ProductReleaseVersion | null {
  const match = tag.match(releaseTagPattern)
  if (!match) return null

  const major = Number(match[2])
  const minor = Number(match[3])
  const patch = Number(match[4])
  const beta = match[5] === undefined ? undefined : Number(match[5])

  return {
    core: [major, minor, patch],
    ...(beta === undefined ? {} : { beta }),
    tag,
  }
}

export function compareProductReleaseVersions(
  left: ProductReleaseVersion,
  right: ProductReleaseVersion,
): number {
  for (const [index, value] of left.core.entries()) {
    const rightValue = right.core[index]
    if (rightValue === undefined) throw new Error('Invalid product release version core')
    const difference = value - rightValue
    if (difference !== 0) return Math.sign(difference)
  }

  if (left.beta === undefined && right.beta === undefined) return 0
  if (left.beta === undefined) return 1
  if (right.beta === undefined) return -1
  return Math.sign(left.beta - right.beta)
}

export function validateProductReleaseOrder(targetTag: string, existingTags: string[]): void {
  const target = parseProductReleaseTag(targetTag)
  if (!target) throw new Error(`Invalid product release tag: ${targetTag}`)

  const prefix = targetTag.slice(0, targetTag.indexOf('-v') + 2)
  const previous = existingTags
    .filter((tag) => tag !== targetTag && tag.startsWith(prefix))
    .map(parseProductReleaseTag)
    .filter((version): version is ProductReleaseVersion => version !== null)
    .sort(compareProductReleaseVersions)
    .at(-1)

  if (previous && compareProductReleaseVersions(target, previous) <= 0) {
    throw new Error(
      `${targetTag} must be newer than the latest existing release tag ${previous.tag}`,
    )
  }
}

export function readProductReleaseTags(product: 'server' | 'editor'): string[] {
  const result = Bun.spawnSync(['git', 'tag', '--list', `${product}-v*`])
  if (result.exitCode !== 0) {
    throw new Error(new TextDecoder().decode(result.stderr).trim() || 'Failed to read Git tags')
  }
  return new TextDecoder()
    .decode(result.stdout)
    .split('\n')
    .map((tag) => tag.trim())
    .filter(Boolean)
}
