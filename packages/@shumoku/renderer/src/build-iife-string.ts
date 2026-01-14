/**
 * Build IIFE string export for embedding in HTML
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const iifePath = join(import.meta.dir, '..', 'dist', 'shumoku-interactive.iife.js')
const outputPath = join(import.meta.dir, '..', 'dist', 'iife-string.js')
const dtsPath = join(import.meta.dir, '..', 'dist', 'iife-string.d.ts')

const iifeContent = readFileSync(iifePath, 'utf-8')

// Export as ES module
const output = `// Auto-generated - do not edit
export const INTERACTIVE_IIFE = ${JSON.stringify(iifeContent)};
`

// Type declaration
const dts = `// Auto-generated - do not edit
export declare const INTERACTIVE_IIFE: string;
`

writeFileSync(outputPath, output)
writeFileSync(dtsPath, dts)
console.log('IIFE string written to dist/iife-string.js')
