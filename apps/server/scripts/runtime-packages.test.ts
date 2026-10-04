import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'

it('loads jsdom resources and the native PNG renderer from an isolated runtime tree', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'shumoku-runtime-packages-'))
  try {
    const copied = spawnSync(
      'bun',
      [
        fileURLToPath(new URL('../api/scripts/materialize-runtime.js', import.meta.url)),
        path.join(directory, 'node_modules'),
      ],
      { cwd: fileURLToPath(new URL('../api/', import.meta.url)), encoding: 'utf8' },
    )
    expect(copied.stderr).toBe('')
    expect(copied.status).toBe(0)
    const loaded = spawnSync(
      'bun',
      [
        '-e',
        `const { JSDOM } = require('jsdom')
const { Resvg } = require('@resvg/resvg-js')
const dom = new JSDOM('<svg><path d="M0 0h1v1H0z"/></svg>')
if (dom.window.document.querySelectorAll('path').length !== 1) throw new Error('DOM unavailable')
dom.window.close()
const png = new Resvg('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>').render().asPng()
if (png[0] !== 137 || png[1] !== 80) throw new Error('PNG unavailable')`,
      ],
      { cwd: directory, encoding: 'utf8' },
    )
    expect(loaded.stderr).toBe('')
    expect(loaded.status).toBe(0)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
