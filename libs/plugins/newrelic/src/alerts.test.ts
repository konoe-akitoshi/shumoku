import { describe, expect, it, vi } from 'vitest'
import { issueAlerts, readIssues } from './alerts.js'
import type { NewRelicClient } from './client.js'

const now = 1800000000000
const issue = {
  issueId: 'issue',
  createdAt: now - 7 * 86400000,
  priority: 'HIGH',
  state: 'ACTIVATED',
  title: ['title'],
  entityGuids: ['a', 'b'],
}
describe('New Relic issues', () => {
  it('keeps old active issues and maps each entity without changing issue identity', () => {
    const alerts = issueAlerts([issue], { hostIds: ['a'] }, now)
    expect(alerts).toHaveLength(1)
    expect(alerts[0]).toMatchObject({
      id: 'issue:a',
      status: 'active',
      severity: 'high',
      hostId: 'a',
      labels: { issueId: 'issue' },
    })
  })
  it.each(['CREATED', 'ACTIVATED', 'DEACTIVATED'])('never marks %s resolved', (state) => {
    expect(issueAlerts([{ ...issue, state }], {}, now)[0]?.status).toBe('active')
  })
  it('filters resolved history and severity while retaining entity-less issues', () => {
    expect(issueAlerts([{ ...issue, state: 'CLOSED', closedAt: now }], {}, now)).toEqual([])
    expect(
      issueAlerts(
        [{ ...issue, state: 'CLOSED', closedAt: now - 7200000 }],
        { activeOnly: false },
        now,
      ),
    ).toEqual([])
    expect(issueAlerts([issue], { minSeverity: 'critical' }, now)).toEqual([])
    expect(issueAlerts([{ ...issue, entityGuids: [] }], {}, now)[0]?.id).toBe('issue')
  })
  it('fails unsupported lifecycle values instead of falsely resolving them', () => {
    expect(() => issueAlerts([{ ...issue, state: 'NEW_STATE' }], {}, now)).toThrow(
      'unsupported issue state',
    )
  })
  it('paginates from epoch and rejects repeated cursors', async () => {
    const graph = vi
      .fn()
      .mockResolvedValueOnce({ aiIssues: { issues: { issues: [issue], nextCursor: 'next' } } })
      .mockResolvedValueOnce({
        aiIssues: { issues: { issues: [{ ...issue, issueId: 'two' }], nextCursor: null } },
      })
    const result = await readIssues({ graph } as unknown as NewRelicClient, 123, {})
    expect(result).toHaveLength(2)
    expect(graph.mock.calls[0]?.[0]).toContain('startTime:0')
    expect(graph.mock.calls[1]?.[1]).toMatchObject({ cursor: 'next' })
    graph.mockResolvedValue({ aiIssues: { issues: { issues: [], nextCursor: 'repeat' } } })
    await expect(readIssues({ graph } as unknown as NewRelicClient, 123, {})).rejects.toThrow(
      'pagination incomplete',
    )
  })
})
