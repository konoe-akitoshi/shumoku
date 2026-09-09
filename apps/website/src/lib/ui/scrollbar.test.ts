import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

describe('native scrollbar appearance contract', () => {
  it('shares native styling without removing the scrollbar or replacing browser behavior', () => {
    const css = source('./scrollbar.css')
    expect(css).toContain('scrollbar-width: thin')
    expect(css).toContain('var(--site-muted)')
    expect(css).toContain('var(--site-bg)')
    expect(css).toContain('(pointer: coarse)')
    expect(css).toContain('(forced-colors: active)')
    expect(css).toContain('scrollbar-width: auto')
    expect(css).toContain('scrollbar-color: auto')
    expect(css).not.toContain('scrollbar-width: none')
    expect(source('./file-tabs.css')).not.toContain('scrollbar-width:')
  })

  it('keeps arrows hidden and themes the two-axis corner without inheriting text cursors', () => {
    const css = source('./scrollbar.css')
    expect(css).toContain('@supports selector(::-webkit-scrollbar)')
    expect(css).toContain('.ui-scrollbar--quiet::-webkit-scrollbar-button { display: none;')
    expect(css).toContain('.ui-scrollbar--quiet:has(:focus-visible)')
    expect(css).toContain(
      '::-webkit-scrollbar-corner { background: var(--ui-scrollbar-track); cursor: default; }',
    )
    expect(css).toContain('border-radius: var(--ui-radius); cursor: default;')
  })

  it('applies the same class to each scrolling element', () => {
    for (const path of ['./FileTabs.svelte', './Tabs.svelte', '../playground/CodeEditor.svelte']) {
      expect(source(path)).toContain('ui-scrollbar')
    }
  })
})
