import { describe, expect, it } from 'vitest'
import { mergeById, resolveMaxPages, resolveScrapeMode } from '../scripts/lib/scrape-snapshot.js'
import type { NewsItem } from '../src/models/item.js'

function item(id: string, publishedAt: string): NewsItem {
  return {
    id,
    sourceId: 'gbc-news',
    title: id,
    url: `https://example.com/${id}`,
    publishedAt,
    categories: ['other'],
    groups: ['other'],
  }
}

describe('scrape-snapshot helpers', () => {
  it('resolveScrapeMode defaults to incremental', () => {
    expect(resolveScrapeMode(undefined)).toBe('incremental')
    expect(resolveScrapeMode('full')).toBe('full')
  })

  it('resolveMaxPages uses emptyDefault for blank values', () => {
    expect(resolveMaxPages(undefined, { envName: 'X', emptyDefault: 3 })).toBe(3)
    expect(resolveMaxPages('all', { envName: 'X', emptyDefault: Number.POSITIVE_INFINITY })).toBe(
      Number.POSITIVE_INFINITY,
    )
  })

  it('mergeById upserts by id and sorts by publishedAt desc', () => {
    const merged = mergeById(
      [item('a', '2026-01-01T00:00:00.000Z'), item('b', '2026-01-02T00:00:00.000Z')],
      [item('b', '2026-01-03T00:00:00.000Z'), item('c', '2026-01-04T00:00:00.000Z')],
    )
    expect(merged.map((entry) => entry.id)).toEqual(['c', 'b', 'a'])
    expect(merged[1]?.publishedAt).toBe('2026-01-03T00:00:00.000Z')
  })
})
