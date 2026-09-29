export type Row = Record<string, unknown>
export function record(value: unknown): Row {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Row) : {}
}
export function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}
export function num(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}
export function literal(value: string): string {
  return `'${value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`
}
export const source = "FROM Metric WHERE metricName LIKE 'kentik.snmp.%'"
export function windowAt(asOf: number, seconds: number): string {
  return `SINCE ${asOf - seconds * 1000} UNTIL ${asOf}`
}
export function fresh(value: unknown, now: number, seconds = 180): boolean {
  const time = num(value)
  return time !== undefined && time <= now + 30_000 && now - time <= seconds * 1000
}
