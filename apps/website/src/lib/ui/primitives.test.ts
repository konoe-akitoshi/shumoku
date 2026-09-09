import { createRawSnippet } from 'svelte'
import { render } from 'svelte/server'
import { describe, expect, it } from 'vitest'
import Button from './Button.svelte'
import IconButton from './IconButton.svelte'
import LinkButton from './LinkButton.svelte'
import NavLink from './NavLink.svelte'
import Notice from './Notice.svelte'
import Panel from './Panel.svelte'
import Tabs from './Tabs.svelte'
import TextArea from './TextArea.svelte'
import TextField from './TextField.svelte'
import TextLink from './TextLink.svelte'
import Toolbar from './Toolbar.svelte'

describe('native control contracts', () => {
  it('links tabs to panels and falls back when the selected item disappears', () => {
    const { body } = render(Tabs, {
      props: {
        id: 'files',
        label: 'Files',
        value: 'deleted',
        items: [
          { value: 'a', label: 'A', disabled: true },
          { value: 'b', label: 'B' },
        ],
        onselect: () => {},
        children: createRawSnippet(() => ({ render: () => '<p>Editor</p>' })),
      },
    })
    expect(body).toContain('aria-controls="files-panel-b"')
    expect(body).toContain('aria-labelledby="files-tab-b"')
    expect(body.match(/aria-selected="true"/g)).toHaveLength(1)
    expect(body.match(/tabindex="0"/g)).toHaveLength(2)
  })
  it('keeps text and navigation links independent of button geometry', () => {
    const text = render(TextLink, { props: { href: '#form' } }).body
    const nav = render(NavLink, { props: { href: '/ja', 'aria-current': 'page' } }).body
    expect(text).toContain('ui-text-link')
    expect(text).not.toContain('ui-control')
    expect(nav).toContain('aria-current="page"')
    expect(nav).not.toContain('ui-control')
  })
  it('connects field labels, hints and errors and preserves external descriptions', () => {
    const { body } = render(TextField, {
      props: {
        id: 'name',
        label: 'Name',
        hint: 'Example',
        error: 'Enter a name',
        'aria-describedby': 'extra',
        required: true,
      },
    })
    expect(body).toContain('for="name"')
    expect(body).toContain('aria-describedby="extra name-hint name-error"')
    expect(body).toContain('aria-invalid="true"')
    expect(body).toContain('required')
  })
  it('preserves textarea native attributes', () => {
    const { body } = render(TextArea, {
      props: { id: 'yaml', label: 'YAML', readonly: true, value: 'nodes: []' },
    })
    expect(body).toContain('readonly')
    expect(body).toContain('nodes: []')
    expect(body).toContain('for="yaml"')
  })
  it('only announces notices when explicitly requested', () => {
    expect(render(Notice, { props: { title: 'Static' } }).body).not.toContain('role="status"')
    expect(
      render(Notice, { props: { title: 'Error', tone: 'danger', live: true } }).body,
    ).toContain('role="alert"')
  })
  it('gives a toolbar one enabled tab stop', () => {
    const { body } = render(Toolbar, {
      props: {
        label: 'View',
        actions: [
          { id: 'a', label: 'A', text: 'A', disabled: true, onclick: () => {} },
          { id: 'b', label: 'B', text: 'B', onclick: () => {} },
          { id: 'c', label: 'C', text: 'C', onclick: () => {} },
        ],
      },
    })
    expect(body).toContain('role="toolbar"')
    expect(body.match(/tabindex="0"/g)).toHaveLength(1)
  })
  it('keeps surfaces non-interactive and applies the chosen structure', () => {
    const { body } = render(Panel, { props: { variant: 'ruled', padded: false, id: 'info' } })
    expect(body).toContain('ui-panel--ruled')
    expect(body).toContain('id="info"')
    expect(body).not.toContain('ui-panel--padded')
    expect(body).not.toContain('role="button"')
    expect(render(Panel).body).toContain('ui-panel--outlined')
  })
  it('defaults to a non-submitting button and forwards native attributes', () => {
    const { body } = render(Button, { props: { disabled: true, 'aria-label': 'Save' } })
    expect(body).toContain('type="button"')
    expect(body).toContain('disabled')
    expect(body).toContain('aria-label="Save"')
  })
  it('supports an explicit submit button', () => {
    expect(
      render(Button, { props: { type: 'submit', name: 'action', value: 'save' } }).body,
    ).toContain('type="submit"')
  })
  it('renders navigation as an anchor, not a button', () => {
    const { body } = render(LinkButton, { props: { href: '/ja', 'aria-current': 'page' } })
    expect(body).toContain('<a ')
    expect(body).toContain('href="/ja"')
    expect(body).not.toContain('<button')
  })
  it('gives icon actions an accessible name', () => {
    const { body } = render(IconButton, { props: { label: 'Zoom in' } })
    expect(body).toContain('aria-label="Zoom in"')
    expect(body).toContain('ui-control--icon')
  })
})
