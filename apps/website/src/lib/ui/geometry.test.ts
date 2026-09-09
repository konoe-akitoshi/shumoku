import { readFileSync } from 'node:fs'
import { createRawSnippet } from 'svelte'
import { render } from 'svelte/server'
import { describe, expect, it } from 'vitest'
import FileTabs from './FileTabs.svelte'

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')
const workbench = source('../playground/workbench.css')
const compact = source('./compact.css')
const tabsCss = source('./file-tabs.css')
const controls = source('./ui.css')

// Architecture guards, not a substitute for browser geometry/optical review.
describe('compact geometry ownership', () => {
  it('defines density in one shared stylesheet, including coarse input', () => {
    expect(controls).toContain("@import './compact.css'")
    expect(compact).toContain('.ui-control.ui-control--compact,')
    expect(compact).toContain('.ui-toolbar.ui-toolbar--compact button,')
    expect(compact).toContain('.ui-file-tab {')
    expect(compact).toContain('box-sizing: border-box')
    expect(compact).toContain('@media (pointer: coarse)')
    for (const css of [controls, tabsCss, workbench]) {
      expect(css).not.toMatch(/--ui-compact-(?:height|action-size|font-size)\s*:/)
    }
  })

  it('keeps hit targets in actual columns and avoids glyph-based geometry', () => {
    expect(tabsCss).toContain(
      'grid-template-columns: minmax(0, auto) var(--ui-compact-action-size)',
    )
    expect(tabsCss).toContain('inline-size: var(--ui-compact-action-size)')
    expect(tabsCss).toContain('block-size: var(--ui-compact-action-size)')
    expect(tabsCss).not.toMatch(/text-box-(?:trim|edge)|transform\s*:|position:\s*absolute|::after/)
    expect(tabsCss).not.toMatch(/(?:opacity:\s*0(?:\D|$)|visibility:\s*hidden)/)
  })

  it('does not let the workbench resize UI kit descendants', () => {
    expect(workbench).not.toMatch(
      /[^{}]*(?:\.ui-control|\.ui-file-close|\[role\s*=\s*['"]?tab)[^{}]*\{/,
    )
  })
})

describe('file tab markup contract', () => {
  const props = {
    id: 'geometry-files',
    label: 'Files',
    items: [{ value: '日本語.yaml', label: '日本語.yaml', closable: false }],
    value: '日本語.yaml',
    onselect: () => {},
    onclose: () => {},
    children: createRawSnippet(() => ({ render: () => '<p>Editor</p>' })),
  }

  it('preserves the standard SVG canvas and an independent named close button', () => {
    const { body } = render(FileTabs, { props })
    expect(body).toContain('viewBox="0 0 24 24"')
    expect(body).not.toContain('ui-file-close-slot')
    expect(body).toContain('aria-label="Close 日本語.yaml"')
    expect(body).toContain('disabled')
    expect(body).toContain('aria-controls="geometry-files-panel"')
    expect(body).toContain(
      `aria-labelledby="geometry-files-tab-${encodeURIComponent('日本語.yaml')}"`,
    )
  })

  it('renders only the selected file content', () => {
    const { body } = render(FileTabs, { props: { ...props, value: 'missing' } })
    expect(body).toContain('No files')
    expect(body).not.toContain('<p>Editor</p>')
  })
})
