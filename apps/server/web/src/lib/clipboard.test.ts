import { describe, expect, it, vi } from 'vitest'
import { copyTextToClipboard } from './clipboard'

describe('copyTextToClipboard', () => {
  it('prefers the Async Clipboard API', async () => {
    const writeText = vi.fn(async () => {})
    const fallback = vi.fn(() => true)

    await copyTextToClipboard('share-url', { writeText, fallback })

    expect(writeText).toHaveBeenCalledWith('share-url')
    expect(fallback).not.toHaveBeenCalled()
  })

  it('falls back when the Async Clipboard API is unavailable', async () => {
    const fallback = vi.fn(() => true)

    await copyTextToClipboard('webhook-url', { fallback })

    expect(fallback).toHaveBeenCalledWith('webhook-url')
  })

  it('falls back when clipboard permission is denied', async () => {
    const writeText = vi.fn(async () => {
      throw new Error('NotAllowedError')
    })
    const fallback = vi.fn(() => true)

    await copyTextToClipboard('resolved-json', { writeText, fallback })

    expect(fallback).toHaveBeenCalledWith('resolved-json')
  })

  it('reports failure when neither copy mechanism works', async () => {
    await expect(copyTextToClipboard('share-url', { fallback: () => false })).rejects.toThrow(
      'Clipboard access is unavailable',
    )
  })
})
