// Run with Bun: bun scripts/prepare-meetup-photos.ts <original-photo-directory>
// Requires FFmpeg on PATH. Originals are read-only; no raster cropping or retouching.

import { spawnSync } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { photos as communityPhotos, photoWidths } from '../src/lib/community/photos'
import { articlePhotos } from './meetup-1-sources'

const source = process.argv[2]
if (!source) throw new Error('Pass the directory containing the original meetup photos')
const target = process.argv[3] ?? 'blog'
if (target !== 'blog' && target !== 'community') throw new Error('Target must be blog or community')
const photos = target === 'blog' ? articlePhotos : communityPhotos
const destination = new URL(
  target === 'blog'
    ? '../src/content/blog/meetup-1/images/'
    : '../public/images/community/meetup-1/',
  import.meta.url,
)
await mkdir(destination, { recursive: true })
for (const [id, photo] of Object.entries(photos)) {
  for (const width of target === 'blog' ? [1920] : photoWidths) {
    const output = new URL(target === 'blog' ? `${id}.webp` : `${id}-${width}.webp`, destination)
    const result = spawnSync(
      'ffmpeg',
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-i',
        resolve(source, photo.source),
        '-vf',
        `scale=${width}:-1`,
        '-frames:v',
        '1',
        '-map_metadata',
        '-1',
        '-c:v',
        'libwebp',
        '-quality',
        '82',
        '-y',
        fileURLToPath(output),
      ],
      { stdio: 'inherit' },
    )
    if (result.error || result.status !== 0) throw result.error ?? new Error(`Failed: ${id}`)
  }
  console.log(`Prepared ${id}`)
}
