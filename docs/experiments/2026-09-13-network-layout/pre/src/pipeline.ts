import { LayoutError } from './errors'
import type { LayoutModel, LayoutSeed } from './model'
import { createLayoutModel } from './model'
import type { LayoutOptions, LayoutSettings } from './options'
import { resolveLayoutSettings } from './options'
import type { DependencyYResult } from './stages/dependency-y/stage'
import { optimizeDependencyY } from './stages/dependency-y/stage'
import type { PortDistributionResult } from './stages/port-distribution'
import { distributePorts } from './stages/port-distribution'
import type { RowPackingResult } from './stages/row-packing'
import { packRows } from './stages/row-packing'
import type { WireChannelResult } from './stages/wire-channels'
import { allocateWireChannels } from './stages/wire-channels'
import type { UpstreamAnalysis } from './upstream'
import { detectUpstream } from './upstream'
import { itemAt } from './utils/collections'

/** Every intermediate result of one layout run, for inspection and tests. */
export interface LayoutStages {
  readonly settings: LayoutSettings
  readonly model: LayoutModel
  readonly upstream: UpstreamAnalysis
  /** Upstream hop distance per node index; `null` inside unresolved components. */
  readonly distances: readonly (number | null)[]
  /** Node whose absolute position every stage preserves. */
  readonly anchor: number
  readonly rowPacking: RowPackingResult
  readonly portDistribution: PortDistributionResult
  readonly wireChannels: WireChannelResult
  readonly dependencyY: DependencyYResult
}

export function runLayoutStages(
  seed: LayoutSeed,
  options: Partial<LayoutOptions> = {},
): LayoutStages {
  const settings = resolveLayoutSettings(options)
  const model = createLayoutModel(seed)
  const upstream = detectUpstream({
    nodes: model.nodes,
    links: model.links.map((link) => ({
      source: itemAt(model.nodes, link.source).id,
      target: itemAt(model.nodes, link.target).id,
    })),
  })
  const distances = model.nodes.map((node) => upstream.distances[node.id] ?? null)
  const anchor = translationGauge(model, upstream)

  const rowPacking = packRows(model, distances, anchor, settings)
  const portDistribution = distributePorts(model, rowPacking, settings)
  const wireChannels = allocateWireChannels(model, portDistribution, anchor, settings)
  const dependencyY = optimizeDependencyY(model, wireChannels, distances, anchor, settings)
  return {
    settings,
    model,
    upstream,
    distances,
    anchor,
    rowPacking,
    portDistribution,
    wireChannels,
    dependencyY,
  }
}

/**
 * The node that pins the drawing against free translation: the first upstream root, or the smallest
 * node id when no root was found. The fallback only fixes a position; it is not treated as upstream.
 */
function translationGauge(model: LayoutModel, upstream: UpstreamAnalysis): number {
  const id = upstream.roots[0] ?? model.nodes.map((node) => node.id).sort()[0]
  const index = model.nodes.findIndex((node) => node.id === id)
  if (index < 0) throw new LayoutError('Layout needs at least one node')
  return index
}
