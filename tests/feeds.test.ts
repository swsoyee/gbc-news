import { describe, expect, it } from 'vitest'
import { buildIcal, buildRss } from '../src/feeds/build.js'
import type { NewsItem } from '../src/models/item.js'

const items: NewsItem[] = [
  {
    id: 'post-1',
    title: 'Live 情報',
    url: 'https://girls-band-cry.com/news/post-1.html',
    publishedAt: '2026-07-01T00:00:00.000Z',
    sourceId: 'gbc-news',
    categories: ['live'],
    summary: 'チケット発売',
  },
]

const meta = {
  title: 'gbc-news',
  homeUrl: 'https://example.com/',
  feedUrl: 'https://example.com/feeds/rss.xml',
  description: 'test',
}

describe('feeds', () => {
  it('生成 RSS', () => {
    const rss = buildRss(items, meta)
    expect(rss).toContain('<rss version="2.0">')
    expect(rss).toContain('Live 情報')
    expect(rss).toContain('<category>live</category>')
  })

  it('生成 iCal', () => {
    const ics = buildIcal(items, meta)
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('UID:post-1@gbc-news')
    expect(ics).toContain('CATEGORIES:live')
  })
})
