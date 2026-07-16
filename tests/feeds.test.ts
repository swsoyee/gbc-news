import { describe, expect, it } from 'vitest'
import { buildIcal, buildRss } from '../src/feeds/build.js'
import { expandEventDates } from '../src/feeds/expand.js'
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

const meta = {
  title: 'gbc-news',
  homeUrl: 'https://example.com/',
  feedUrl: 'https://example.com/feeds/rss.xml',
  description: 'test',
}

describe('expandEventDates', () => {
  it('按日展开并加 kind 前缀', () => {
    const entries = expandEventDates([item])
    expect(entries).toHaveLength(2)
    expect(entries.map((e) => e.title)).toEqual(['[発売] Live 情報', '[開催] Live 情報'])
    expect(entries[0]?.entryId).toBe('post-1-2026-06-26-sale')
    expect(entries[1]?.entryId).toBe('post-1-2026-09-06-hold')
  })

  it('无 eventDates 的条目不进入 feeds', () => {
    const { eventDates: _e, ...noDates } = item
    expect(expandEventDates([noDates])).toEqual([])
  })
})

describe('feeds', () => {
  it('RSS pubDate 使用活动日且 guid 含 date+kind', () => {
    const entries = expandEventDates([item])
    const rss = buildRss(entries, meta)
    expect(rss).toContain('[開催] Live 情報')
    expect(rss).toContain('[発売] Live 情報')
    expect(rss).toContain('post-1-2026-09-06-hold@gbc-news')
    expect(rss).toContain(new Date('2026-09-06T00:00:00.000Z').toUTCString())
    expect(rss).not.toContain(new Date(item.publishedAt).toUTCString())
    expect(rss).toContain('<category>live</category>')
    expect(rss).toContain('domain="group">togenashi')
  })

  it('iCal DTSTART 使用活动日', () => {
    const entries = expandEventDates([item])
    const ics = buildIcal(entries, meta)
    expect(ics).toContain('UID:post-1-2026-09-06-hold@gbc-news')
    expect(ics).toContain('DTSTART;VALUE=DATE:20260906')
    expect(ics).toContain('DTSTART;VALUE=DATE:20260626')
    expect(ics).toContain('SUMMARY:[開催] Live 情報')
    expect(ics).toContain('CATEGORIES:togenashi,live')

    const longTitleItem: NewsItem = {
      ...item,
      id: 'post-long',
      title:
        '劇場版総集編「ガールズバンドクライ」【前編】青春狂走曲（初回限定版）/【後編】なぁ、未来。（初回限定版）特典CD楽曲の試聴動画を公開！',
      eventDates: [{ date: '2026-09-06', kind: 'hold' }],
    }
    const longIcs = buildIcal(expandEventDates([longTitleItem]), meta)
    for (const line of longIcs.split('\r\n')) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75)
    }
  })
})
