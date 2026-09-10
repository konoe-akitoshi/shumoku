import { readFileSync } from 'node:fs'
import { createRawSnippet } from 'svelte'
import { render } from 'svelte/server'
import { describe, expect, it } from 'vitest'
import NavLink from './NavLink.svelte'
import Tabs from './Tabs.svelte'

describe('shared text marker', () => {
  it('separates the label from the navigation target', () => {
    const { body } = render(NavLink, {
      props: {
        href: '/ja',
        'aria-current': 'page',
        children: createRawSnippet(() => ({ render: () => '<span>Home</span>' })),
      },
    })
    expect(body).toContain('ui-nav-link ui-marker')
    expect(body).toContain('class="ui-marker-label"')
    expect(body).toContain('aria-current="page"')
  })

  it('preserves tab state and disabled behavior with the same label primitive', () => {
    const { body } = render(Tabs, {
      props: {
        id: 'marker-test',
        label: 'Views',
        value: 'source',
        onselect: () => {},
        items: [
          { value: 'source', label: 'Source' },
          { value: 'history', label: 'History', disabled: true },
        ],
        children: createRawSnippet(() => ({ render: () => '<p>Source panel</p>' })),
      },
    })
    expect(body).toContain('class="ui-marker"')
    expect(body).toContain('class="ui-marker-label"')
    expect(body).toContain('aria-selected="true"')
    expect(body).toContain('disabled')
  })

  it('owns state decoration without changing typography or using transparency', () => {
    const css = readFileSync(new URL('./selection-marker.css', import.meta.url), 'utf8')
    expect(css).toContain('@media (hover: hover)')
    expect(css).toContain(":not(:disabled):not([aria-disabled='true'])")
    expect(css).toContain('padding-inline: var(--ui-marker-inset)')
    expect(css).not.toMatch(/font-weight|opacity|text-stroke|color-mix/)
  })
})
