#!/usr/bin/env bun
// Regenerates palette.css from palette-model.ts. Run with --write to update
// the committed file; without it, prints the generated CSS to stdout.
import { writeFileSync } from 'node:fs'
import { paletteCss } from '../src/lib/ui/palette-model'

const css = paletteCss()
if (process.argv.includes('--write')) {
  writeFileSync(new URL('../src/lib/ui/palette.css', import.meta.url), css)
} else {
  process.stdout.write(css)
}
