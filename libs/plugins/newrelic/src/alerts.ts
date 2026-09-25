import type { Alert, AlertQueryOptions, AlertSeverity } from '@shumoku/core'
import { severityAtLeast } from '@shumoku/core/plugin-kit'
import type { NewRelicClient } from './client.js'
import { num, type Row, record, str } from './values.js'

export function issueAlerts(rows: Row[], options: AlertQueryOptions, now: number): Alert[] {
  const severities: Record<string, AlertSeverity> = {
    CRITICAL: 'critical',
    HIGH: 'high',
    MEDIUM: 'medium',
    LOW: 'low',
  }
  return rows.flatMap((row): Alert[] => {
    const state = str(row['state'])
    // A new/unrecognized lifecycle value cannot safely mean resolved.
    if (!state || !['CREATED', 'ACTIVATED', 'DEACTIVATED', 'CLOSED'].includes(state))
      throw new Error('New Relic returned an unsupported issue state')
    const status = state === 'CLOSED' ? 'resolved' : 'active'
    if (options.activeOnly !== false && status === 'resolved') return []
    if (
      status === 'resolved' &&
      (num(row['closedAt']) ?? 0) < now - (options.timeRange ?? 3600) * 1000
    )
      return []
    const severity = severities[String(row['priority'])] ?? 'info'
    if (options.minSeverity && !severityAtLeast(severity, options.minSeverity)) return []
    const id = str(row['issueId'])
    const startTime = num(row['createdAt'])
    if (!id || startTime === undefined) throw new Error('New Relic returned an incomplete issue')
    const guids = Array.isArray(row['entityGuids'])
      ? row['entityGuids'].flatMap((g) => (typeof g === 'string' ? [g] : []))
      : []
    const urls = Array.isArray(row['deepLinkUrl']) ? row['deepLinkUrl'] : []
    const url = typeof urls[0] === 'string' && /^https:\/\//.test(urls[0]) ? urls[0] : undefined
    const hostIds = guids
    return (hostIds.length ? hostIds : [undefined]).flatMap((guid): Alert[] => {
      // Caller supplies an exact GUID → host ID table, including Infrastructure's namespace.
      const hostId = guid
      if (options.hostIds && (!hostId || !options.hostIds.includes(hostId))) return []
      return [
        {
          id: hostId ? `${id}:${hostId}` : id,
          source: 'newrelic',
          severity,
          status,
          title: Array.isArray(row['title'])
            ? row['title'].filter((t) => typeof t === 'string').join('; ')
            : 'New Relic issue',
          startTime,
          ...(status === 'resolved' ? { endTime: num(row['closedAt']) } : {}),
          hostId,
          url,
          labels: { issueId: id, issueState: state },
        },
      ]
    })
  })
}

export async function readIssues(
  client: NewRelicClient,
  accountId: number,
  options: AlertQueryOptions,
): Promise<Row[]> {
  const rows: Row[] = []
  const seen = new Set<string>()
  let cursor: string | undefined
  const now = Date.now()
  const states =
    options.activeOnly !== false
      ? '[CREATED,ACTIVATED,DEACTIVATED]'
      : '[CREATED,ACTIVATED,DEACTIVATED,CLOSED]'
  do {
    // Explicit epoch avoids the API's default 24h window losing long-running issues.
    const data = await client.graph(
      `query($account:Int!,$cursor:String){actor{account(id:$account){aiIssues{issues(cursor:$cursor,filter:{states:${states}},timeWindow:{startTime:0,endTime:${now}}){issues{issueId title priority state createdAt closedAt entityGuids deepLinkUrl} nextCursor}}}}}`,
      { account: accountId, cursor: cursor ?? null },
    )
    const page = record(record(data['aiIssues'])['issues'])
    if (!Array.isArray(page['issues']))
      throw new Error('New Relic issue query unavailable; verify issue API permissions')
    rows.push(...page['issues'].map(record))
    cursor = str(page['nextCursor'])
    if (cursor && (seen.has(cursor) || seen.size >= 500))
      throw new Error('New Relic issue pagination incomplete')
    if (cursor) seen.add(cursor)
  } while (cursor)
  return rows
}
