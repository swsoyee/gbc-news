import { describe, expect, it } from 'vitest'
import { createDynamicFeed } from '../src/feeds/dynamic-feed.js'
import type { NewsItem } from '../src/models/item.js'

const item: NewsItem = {
  id: 'post-1',
  title: 'Live 情報',
  url: 'https://girls-band-cry.com/news/post-1.html',
  publishedAt: '2026-07-01T00:00:00.000Z',
  sourceId: 'gbc-news',
  categories: ['live'],
  groups: ['togenashi'],
  summary: 'チケット発売',
  eventDates: [
    { date: '2026-09-06', kind: 'hold' },
    { date: '2026-06-26', kind: 'sale' },
  ],
}

const other: NewsItem = {
  ...item,
  id: 'post-2',
  title: 'Goods',
  categories: ['goods'],
  groups: ['f272'],
  eventDates: [{ date: '2026-08-01', kind: 'sale' }],
}

describe('createDynamicFeed', () => {
  it('默认输出 RSS', () => {
    const result = createDynamicFeed({
      origin: 'https://example.com',
      items: [item],
    })
    expect(result.statusCode).toBe(200)
    expect(result.headers['content-type']).toContain('application/rss+xml')
    expect(result.body).toContain('[举办] Live 情報')
    expect(result.body).toContain('https://example.com/api/feed?format=rss')
  })

  it('format=ics 输出日历', () => {
    const result = createDynamicFeed({
      origin: 'https://example.com',
      format: 'ics',
      items: [item],
    })
    expect(result.statusCode).toBe(200)
    expect(result.headers['content-type']).toContain('text/calendar')
    expect(result.body).toContain('BEGIN:VCALENDAR')
    expect(result.body).toContain('DTSTART;VALUE=DATE:20260906')
  })

  it('空数据集返回 503', () => {
    const result = createDynamicFeed({
      origin: 'https://example.com',
      items: [],
    })
    expect(result.statusCode).toBe(503)
    expect(JSON.parse(result.body)).toEqual({ error: 'news dataset is empty' })
  })

  it('按 groups∧categories 过滤', () => {
    const result = createDynamicFeed({
      origin: 'https://example.com',
      groups: 'togenashi',
      categories: 'live',
      items: [item, other],
    })
    expect(result.statusCode).toBe(200)
    expect(result.body).toContain('Live 情報')
    expect(result.body).not.toContain('Goods')
    expect(result.body).toContain('groups=togenashi')
    expect(result.body).toContain('categories=live')
  })

  it('非法条目抛错由调用方捕获', () => {
    expect(() =>
      createDynamicFeed({
        origin: 'https://example.com',
        items: [{ id: 'bad' } as NewsItem],
      }),
    ).toThrow(/NewsItem/)
  })
})
