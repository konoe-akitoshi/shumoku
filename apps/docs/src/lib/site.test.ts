import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { pageTitle, siteName } from './site'

describe('pageTitle', () => {
  test('uses only the site name for the home page', () => {
    assert.equal(pageTitle('Shumoku', true), siteName)
  })

  test('appends the site name to article titles', () => {
    assert.equal(pageTitle('Getting started'), 'Getting started · Shumoku Docs')
  })

  test('does not duplicate the site name', () => {
    assert.equal(pageTitle(siteName), siteName)
  })
})
