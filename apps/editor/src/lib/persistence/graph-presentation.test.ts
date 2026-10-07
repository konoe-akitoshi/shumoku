import { expect, test } from 'vitest'
import { parseGraphPresentation } from './graph-presentation'

test('stores only explicit validated graph settings without introducing defaults', () => {
  const value = { settings: { direction: 'LR' as const, legend: false, nodeSpacing: 0 } }
  const parsed = parseGraphPresentation(value)
  expect(parsed).toEqual(value)
  expect(parsed.settings).not.toBe(value.settings)
  expect(parseGraphPresentation()).toEqual({})
  expect(parseGraphPresentation({ settings: undefined })).toEqual({})
})

test('rejects unknown project display fields and invalid settings', () => {
  expect(() => parseGraphPresentation(JSON.parse('{"extra":true}'))).toThrow('only graph settings')
  expect(() => parseGraphPresentation({ settings: { nodeSpacing: -1 } })).toThrow()
})
