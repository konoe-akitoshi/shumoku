import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'

const output = new URL('../dist/', import.meta.url)
const assets = new URL('../../../assets/', import.meta.url)
for (const name of [
  'favicon.svg',
  'favicon.ico',
  'favicon-96x96.png',
  'apple-touch-icon.png',
  'web-app-manifest-192x192.png',
  'web-app-manifest-512x512.png',
]) {
  assert.deepEqual(
    await readFile(new URL(name, output)),
    await readFile(new URL(name, assets)),
    `${name} must match canonical brand assets`,
  )
}
const manifest = JSON.parse(await readFile(new URL('site.webmanifest', output), 'utf8'))
assert.equal(manifest.name, 'Shumoku Docs')
assert.equal(manifest.display, 'browser')
for (const icon of manifest.icons) await readFile(new URL(icon.src.slice(1), output))

let pages = 0
for (const file of await readdir(output, { recursive: true })) {
  if (!file.endsWith('.html')) continue
  const html = await readFile(new URL(file, output), 'utf8')
  assert.ok(html.includes('href="/favicon.svg"'), `${file}: missing favicon`)
  assert.ok(html.includes('href="/apple-touch-icon.png"'), `${file}: missing touch icon`)
  assert.ok(html.includes('href="/site.webmanifest"'), `${file}: missing manifest`)
  if (html.includes('application/ld+json')) {
    assert.equal((html.match(/property="og:title"/g) ?? []).length, 1, `${file}: one OG title`)
    assert.equal((html.match(/rel="canonical"/g) ?? []).length, 1, `${file}: one canonical`)
  }
  pages += 1
}
assert.ok(pages > 0)
console.log(`Site identity checked: ${pages} HTML pages and shared icon assets`)
