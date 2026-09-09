import { render } from 'svelte/server'
import { describe, expect, it } from 'vitest'
import Checkbox from './Checkbox.svelte'
import EmptyState from './EmptyState.svelte'
import { fieldDescription } from './field'
import SelectField from './SelectField.svelte'

describe('form and empty-state primitives', () => {
  it('composes descriptions without inventing empty references', () => {
    expect(fieldDescription('name')).toBeUndefined()
    expect(fieldDescription('name', 'Hint', 'Error', 'external')).toBe(
      'external name-hint name-error',
    )
  })
  it('keeps select options and validation native', () => {
    const { body } = render(SelectField, {
      props: {
        id: 'format',
        name: 'format',
        label: 'Format',
        value: 'svg',
        required: true,
        hint: 'Choose',
        error: 'Unavailable',
        'aria-describedby': 'extra',
        options: [
          { value: 'svg', label: 'SVG' },
          { value: 'pdf', label: 'PDF', disabled: true },
        ],
      },
    })
    expect(body).toContain('<select')
    expect(body).toContain('for="format"')
    expect(body).toContain('aria-describedby="extra format-hint format-error"')
    expect(body).toContain('aria-invalid="true"')
    expect(body).toContain('disabled')
    expect(body).toContain('required')
  })
  it('keeps checkbox state, form value and disabled behavior native', () => {
    const { body } = render(Checkbox, {
      props: {
        id: 'labels',
        name: 'labels',
        value: 'yes',
        label: 'Labels',
        checked: true,
        disabled: true,
        hint: 'Not available',
      },
    })
    expect(body).toContain('type="checkbox"')
    expect(body).toContain('checked')
    expect(body).toContain('disabled')
    expect(body).toContain('value="yes"')
    expect(body).toContain('for="labels"')
    expect(body).toContain('aria-describedby="labels-hint"')
  })
  it('does not announce empty content as an error or add a fake action', () => {
    const { body } = render(EmptyState, {
      props: { title: 'No diagram', description: 'Choose Render.' },
    })
    expect(body).toContain('No diagram')
    expect(body).toContain('Choose Render.')
    expect(body).not.toContain('role="alert"')
    expect(body).not.toContain('<button')
  })
})
