import { readdirSync, readFileSync } from 'node:fs'

// For each arm's final YAML, the rate written on each link that is not a plain cable in the task.
const final = (arm: string, i: number) => {
  const pattern = new RegExp(String.raw`^${arm}-${i}(-f\d)?\.yaml$`)
  const files = readdirSync('.')
    .filter((f) => pattern.test(f))
    .sort()
  // The last fix round if any, else the first answer.
  return files.filter((f) => /-f\d/.test(f)).at(-1) ?? files[0] ?? ''
}
const pick = (ends: string[]) => {
  const s = ends.join(' ')
  if (/rt-2/.test(s) && /rt-1/.test(s)) return 'rt1-rt2'
  if (/ergw|azure|express/i.test(s)) return 'er'
  if (/prn/.test(s)) return 'printer'
  if (/sw-2/.test(s) && /sw-1/.test(s)) return 'lag'
  if (/rt-1/.test(s) && /sw-1/.test(s)) return 'core'
  return s
}
for (const arm of (process.argv[2] ?? 'a,b,c,d').split(',')) {
  console.log(`== ${arm}`)
  for (const i of [1, 2, 3, 4, 5, 6]) {
    const f = final(arm, i)
    const doc = Bun.YAML.parse(readFileSync(f, 'utf8')) as { links?: Record<string, unknown>[] }
    const row = (doc.links ?? []).map((l) => {
      const ends = ((l.endpoints as Record<string, string>[]) ?? []).map((e) =>
        Object.values(e).join(':'),
      )
      const r = [l.speed, l.speedMbps, l.bandwidth].filter((v) => v !== undefined).join('/')
      const d = l.description ? `"${String(l.description).slice(0, 40)}"` : ''
      return `${pick(ends)}${l.virtual ? '(v)' : ''}=${r || '-'}${d}`
    })
    console.log(`${f}: ${row.join('  ')}`)
  }
}
