import { describe, expect, test } from 'bun:test'
import { runLayoutStages } from '../src/pipeline'
import { layoutNetwork, presentLayout } from '../src/result'
import { differenceOf, solveSpringSystem } from '../src/stages/dependency-y/solver'
import { itemAt } from '../src/utils/collections'
import type { CheckpointReport } from './test6'
import { LINK_END_OF, largestDeviation, loadTest6Seed, readArchiveReport } from './test6'

/** Coordinates must match the archived checkpoint to well below a device pixel. */
const TOLERANCE = 1e-6

const checkpoint = await readArchiveReport<CheckpointReport>('dependency-y')
const seed = await loadTest6Seed()
const untouchedSeed = structuredClone(seed)
const stages = runLayoutStages(seed)
const layout = presentLayout(stages)
const final = stages.dependencyY

function expectReproduced(actual: unknown, expected: unknown): void {
  const { deviation, path } = largestDeviation(actual, expected)
  if (!(deviation < TOLERANCE))
    throw new Error(`Deviation ${deviation} at ${path} exceeds ${TOLERANCE}`)
}

describe('test6 checkpoint (dependency-y with upstream detection)', () => {
  test('detects the upstream root from connections alone', () => {
    expect(layout.upstream.roots).toEqual([...checkpoint.upstream.roots])
    expect(layout.translationGaugeId).toBe('test:internet')
  })

  test('reproduces device boxes and group frames', () => {
    expectReproduced(
      layout.nodes.map(({ id, x, y, w, h }) => ({ id, x, y, w, h })),
      checkpoint.nodes.map(({ id, x, y, w, h }) => ({ id, x, y, w, h })),
    )
    expectReproduced(
      layout.groups.map(({ id, x, y, w, h }) => ({ id, x, y, w, h })),
      checkpoint.groups.map(({ id, x, y, w, h }) => ({ id, x, y, w, h })),
    )
  })

  test('reproduces every wire path and frame crossing', () => {
    expectReproduced(
      layout.links.map((link) => ({
        id: link.id,
        points: link.points,
        exit: link.boundary?.exit ?? null,
        entry: link.boundary?.entry ?? null,
      })),
      checkpoint.links.map((link) => ({
        id: link.id,
        points: link.points,
        exit: link.exit ?? null,
        entry: link.entry ?? null,
      })),
    )
  })

  test('reproduces terminals, ports and lanes', () => {
    expectReproduced(
      final.terminals.map(({ link, end, group, side, x, y }) => ({ link, end, group, side, x, y })),
      checkpoint.terminals.map(({ li, end, g, side, x, y }) => ({
        link: li,
        end: LINK_END_OF[end],
        group: g,
        side,
        x,
        y,
      })),
    )
    expectReproduced(
      final.ports.map(({ link, end, node, side, rank, count, x, y }) => ({
        link,
        end,
        node,
        side,
        rank,
        count,
        x,
        y,
      })),
      checkpoint.nodePorts.map(({ li, end, node, side, rank, count, x, y }) => ({
        link: li,
        end: LINK_END_OF[end],
        node,
        side,
        rank,
        count,
        x,
        y,
      })),
    )
    expectReproduced(
      final.lanes.map(({ link, group, left, right, y }) => ({ link, group, left, right, y })),
      checkpoint.virtualNodes.map(({ li, gi, left, right, y }) => ({
        link: li,
        group: gi,
        left,
        right,
        y,
      })),
    )
  })

  test('reproduces the dependency springs of every group', () => {
    expectReproduced(
      final.solves.map(({ problem }) => problem.dependencies),
      checkpoint.dependencyOptimization.groups.map((group) => group.dependencies),
    )
  })

  test('reproduces the drawing metrics and stays drawable', () => {
    const expected = checkpoint.avoidance.after
    const metrics = layout.diagnostics.metrics
    expect(metrics.crossings).toBe(expected.crossings)
    expect(metrics.lineHits).toBe(0)
    expect(metrics.lineNearPairs).toBe(0)
    expect(metrics.nodeHaloOverlaps).toBe(0)
    expect(metrics.groupHaloOverlaps).toBe(0)
    expectReproduced(
      [
        metrics.length,
        metrics.overlapLength,
        metrics.nodeMinVisibleGap,
        metrics.groupMinVisibleGap,
      ],
      [
        expected.length,
        expected.overlapLength,
        expected.nodeMinVisibleGap,
        expected.groupMinVisibleGap,
      ],
    )
  })

  test('each group solution is feasible and independent of its starting Y', () => {
    for (const { problem, solution } of final.solves) {
      for (const constraint of problem.constraints) {
        const difference = differenceOf(solution.values, constraint)
        expect(difference).toBeGreaterThanOrEqual((constraint.min ?? -Infinity) - 1e-6)
        expect(difference).toBeLessThanOrEqual((constraint.max ?? Infinity) + 1e-6)
      }
      const jittered = problem.initial.map((y, index) => y + Math.sin(index * 17 + 1) * 190)
      const resolved = solveSpringSystem(jittered, problem.springs, problem.constraints, {
        maxIterations: stages.settings.solverMaxIterations,
        tolerance: stages.settings.solverTolerance,
      })
      for (const [index, value] of solution.values.entries())
        expect(itemAt(resolved.values, index)).toBeCloseTo(value, 4)
    }
  })

  test('does not mutate the seed', () => {
    expect(seed).toEqual(untouchedSeed)
  })
})

describe('test6 seed variations', () => {
  test('renaming the upstream node changes nothing but its id', () => {
    const renamed = {
      ...seed,
      nodes: seed.nodes.map((node) =>
        node.id === 'test:internet' ? { ...node, id: 'anonymous-root' } : node,
      ),
      groups: seed.groups.map((group) => ({
        ...group,
        nodeIds: group.nodeIds.map((id) => (id === 'test:internet' ? 'anonymous-root' : id)),
      })),
      links: seed.links.map((link) => ({
        ...link,
        source: link.source === 'test:internet' ? 'anonymous-root' : link.source,
        target: link.target === 'test:internet' ? 'anonymous-root' : link.target,
      })),
    }
    const result = layoutNetwork(renamed)
    expect(result.upstream.roots).toEqual(['anonymous-root'])
    expectReproduced(
      result.nodes.map(({ x, y }) => ({ x, y })),
      layout.nodes.map(({ x, y }) => ({ x, y })),
    )
  }, 30000)

  test('an isolated component stays unresolved without disturbing the known one', () => {
    const lastFrame = itemAt(seed.groups, seed.groups.length - 1).frame
    const isolated = {
      ...seed,
      nodes: [
        ...seed.nodes,
        {
          id: 'isolated',
          width: 80,
          height: 40,
          position: { x: 10000, y: 10000 },
          preferredOffsetX: 0,
        },
      ],
      groups: [
        ...seed.groups,
        {
          id: 'isolated-group',
          nodeIds: ['isolated'],
          frame: { ...lastFrame, x: 10000, y: 10000, w: 160, h: 120 },
          padding: { left: 24, right: 24, top: 44, bottom: 24 },
        },
      ],
    }
    const result = runLayoutStages(isolated)
    expect(result.upstream.roots).toEqual(stages.upstream.roots)
    expect(result.upstream.unresolved).toHaveLength(1)
    expect(itemAt(result.distances, seed.nodes.length)).toBeNull()
    expect(
      result.dependencyY.solves.slice(0, -1).map(({ problem }) => problem.dependencies),
    ).toEqual(final.solves.map(({ problem }) => problem.dependencies))
    expect(result.dependencyY.metrics.groupHaloOverlaps).toBe(0)
  }, 30000)
})
