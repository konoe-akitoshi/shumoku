/**
 * CSS Build Script
 * Generates optional stylesheet for interactive components
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const css = `/**
 * @shumoku/renderer - Optional Stylesheet
 * Import this if you want to customize styles via CSS instead of JS
 */

/* CSS Custom Properties (override these for theming) */
:root {
  --shumoku-bg: #ffffff;
  --shumoku-surface: #ffffff;
  --shumoku-text: #1e293b;
  --shumoku-text-secondary: #64748b;
  --shumoku-border: #e2e8f0;
  --shumoku-node-fill: #e2e8f0;
  --shumoku-node-stroke: #64748b;
  --shumoku-link-stroke: #94a3b8;
  --shumoku-font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  :root {
    --shumoku-bg: #1e293b;
    --shumoku-surface: #334155;
    --shumoku-text: #f1f5f9;
    --shumoku-text-secondary: #94a3b8;
    --shumoku-border: #475569;
    --shumoku-node-fill: #334155;
    --shumoku-node-stroke: #64748b;
    --shumoku-link-stroke: #64748b;
  }
}

/* Tooltip */
.shumoku-tooltip {
  position: fixed;
  z-index: 10001;
  max-width: 300px;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 12px;
  line-height: 1.4;
  pointer-events: none;
  background: var(--shumoku-surface);
  color: var(--shumoku-text);
  border: 1px solid var(--shumoku-border);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  font-family: var(--shumoku-font);
}

/* Modal Backdrop */
.shumoku-modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10000;
  background: rgba(0, 0, 0, 0.4);
}

/* Modal */
.shumoku-modal {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 10001;
  min-width: 320px;
  max-width: 480px;
  max-height: 80vh;
  overflow-y: auto;
  border-radius: 12px;
  background: var(--shumoku-surface);
  color: var(--shumoku-text);
  border: 1px solid var(--shumoku-border);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
  font-family: var(--shumoku-font);
}

/* Bottom Sheet Backdrop */
.shumoku-bottom-sheet-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10000;
  background: rgba(0, 0, 0, 0.4);
}

/* Bottom Sheet */
.shumoku-bottom-sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10001;
  max-height: 80vh;
  overflow: hidden;
  border-radius: 16px 16px 0 0;
  background: var(--shumoku-surface);
  color: var(--shumoku-text);
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.15);
  font-family: var(--shumoku-font);
}

/* Bottom Sheet Handle */
.shumoku-sheet-handle {
  padding: 12px;
  text-align: center;
  cursor: grab;
}

.shumoku-sheet-handle > div {
  width: 36px;
  height: 4px;
  background: var(--shumoku-border);
  border-radius: 2px;
  margin: 0 auto;
}

/* Close Button */
.shumoku-modal-close {
  padding: 8px 16px;
  border-radius: 6px;
  border: 1px solid var(--shumoku-border);
  background: var(--shumoku-surface);
  color: var(--shumoku-text);
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.shumoku-modal-close:hover {
  background: var(--shumoku-bg);
}
`

// Ensure dist directory exists
const distDir = join(__dirname, '..', 'dist')
if (!existsSync(distDir)) {
  mkdirSync(distDir, { recursive: true })
}

// Write CSS file
const outputPath = join(distDir, 'style.css')
writeFileSync(outputPath, css)
console.log(`CSS written to ${outputPath}`)
