import { render } from 'svelte/server'
import { describe, expect, it } from 'vitest'
import CodeEditor from './CodeEditor.svelte'

describe('code editor gutter', () => {
  it.each([
    [1, 2],
    [99, 2],
    [100, 3],
    [1000, 4],
  ])('sizes %s lines to %s digits', (lines, digits) => {
    const { body } = render(CodeEditor, {
      props: {
        name: 'main.yaml',
        value: Array.from({ length: lines }, () => 'x').join('\n'),
        onchange: () => {},
      },
    })
    expect(body).toContain(`--gutter-digits: ${digits}`)
    expect(body).toContain('aria-hidden="true"')
    expect(body).toContain('aria-label="main.yaml source"')
    expect(body).toContain('wrap="off"')
  })
})
