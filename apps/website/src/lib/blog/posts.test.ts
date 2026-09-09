import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { communityPhotos, photoUrl as communityPhotoUrl, photoWidths } from '../community/photos'
import { articleAsset } from './assets'
import { findPost, loadPost, posts, postsFor, readPost } from './posts'

describe('Markdown articles', () => {
  it('discovers Japanese articles without requiring a translation', async () => {
    expect(findPost('meetup-1', 'ja')?.path).toBe('/blog/meetup-1')
    expect(findPost('meetup-1', 'en')?.locale).toBe('ja')
    expect((await loadPost('meetup-1', 'ja'))?.Content).toBeDefined()
    expect(postsFor('ja').every((post) => !post.draft)).toBe(true)
    expect(postsFor('en')).toEqual(postsFor('ja'))
    expect((await loadPost('meetup-1', 'ja'))?.fallback).toBe(false)
    expect((await loadPost('meetup-1', 'en'))?.fallback).toBe(true)
  })
  it('does not load missing articles or traversal paths', async () => {
    expect(await loadPost('missing', 'ja')).toBeUndefined()
    expect(await loadPost('../meetup-1', 'ja')).toBeUndefined()
  })
  it('validates metadata, dates and draft flags', () => {
    const path = '/src/content/blog/example/index.md'
    const valid = { title: 'Example', description: 'Description', date: '2026-09-10' }
    expect(readPost(path, valid).draft).toBe(false)
    expect(readPost(path, { ...valid, draft: true }).draft).toBe(true)
    for (const invalid of [
      { ...valid, title: '' },
      { ...valid, date: '2026-02-30' },
      { ...valid, date: new Date() },
      { ...valid, draft: 'false' },
      { ...valid, lang: 'xx' },
      { ...valid, image: './images/cover.webp' },
    ])
      expect(() => readPost(path, invalid)).toThrow()
  })
  it('resolves colocated assets and reports missing files', () => {
    expect(articleAsset('meetup-1', './images/group.webp')).toBeTruthy()
    expect(() => articleAsset('meetup-1', './images/missing.webp')).toThrow('Missing article image')
    expect(new Set(posts.map((post) => `${post.locale}${post.path}`)).size).toBe(posts.length)
  })
})

describe('Independent photo collections', () => {
  it('keeps article text and photo choices in one ordinary Markdown file', () => {
    const markdown = readFileSync(
      new URL('../../content/blog/meetup-1/index.md', import.meta.url),
      'utf8',
    )
    expect(markdown).not.toMatch(/<script|PhotoGallery|import /)
    expect(markdown).toContain('./images/laptops.webp')
    const images = [...markdown.matchAll(/!\[([^\]]+)\]\(([^)]+)\)/g)]
    expect(images).toHaveLength(10)
    for (const image of images) {
      expect(image[1].length).toBeGreaterThan(0)
      expect(image[2]).toMatch(/^\.\/images\//)
      expect(existsSync(new URL(`../../content/blog/meetup-1/${image[2]}`, import.meta.url))).toBe(
        true,
      )
      expect(articleAsset('meetup-1', image[2])).toBeTruthy()
    }
  })
  it('keeps Community selection and files independent', () => {
    expect(new Set(communityPhotos).size).toBe(communityPhotos.length)
    expect(communityPhotos).not.toContain('laptops')
    for (const id of communityPhotos) {
      for (const width of photoWidths) {
        const url = communityPhotoUrl(id, width)
        expect(url).toMatch(/^\/images\/community\//)
        expect(existsSync(new URL(`../../../public${url}`, import.meta.url))).toBe(true)
      }
    }
  })
})
