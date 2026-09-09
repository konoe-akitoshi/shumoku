import { describe, expect, it } from 'vitest'
import { controlClass } from './control'

describe('control variants', () => {
  it('keeps command decoration separate from inline links', () => {
    const css = readFileSync(new URL('./ui.css', import.meta.url), 'utf8')
    expect(css).not.toContain('.ui-control--link')
    expect(css).toMatch(/\.ui-text-link\s*\{[^}]*text-decoration: underline/)
    expect(css).toContain('--ui-control-active:')
    expect(css).toContain(":active:not(:disabled):not([aria-disabled='true'])")
    const hoverRules = css.slice(css.indexOf('@media (hover: hover)'))
    expect(hoverRules).toContain('.ui-control--primary:hover')
    expect(hoverRules).toContain(":not(:active):not(:disabled):not([aria-disabled='true'])")
  })
  it('provides one base style for buttons and links', () => {
    expect(controlClass()).toBe('ui-control ui-control--secondary ui-control--default')
  })
  it('keeps sizes explicit and supports layout classes', () => {
    expect(controlClass('primary', 'large', ['flex-1', { hidden: false }])).toBe(
      'ui-control ui-control--primary ui-control--large flex-1',
    )
    expect(controlClass('ghost', 'icon')).toContain('ui-control--icon')
    expect(controlClass('primary', 'compact')).toBe(
      'ui-control ui-control--primary ui-control--compact',
    )
  })
})

import { readFileSync } from 'node:fs'
