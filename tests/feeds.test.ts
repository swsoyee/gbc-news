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

  it('生成兼容日历客户端的全天 iCal（使用事件发生日）', () => {
    const ics = buildIcal(
      [
        {
          ...items[0]!,
          eventAt: '2026-09-06T00:00:00.000Z',
          eventEndAt: '2026-09-06T00:00:00.000Z',
        },
      ],
      meta,
    )
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('UID:post-1@gbc-news')
    expect(ics).toContain('DTSTART;VALUE=DATE:20260906')
    expect(ics).toContain('DTEND;VALUE=DATE:20260907')
    expect(ics).toContain('CATEGORIES:live')
    expect(ics).toContain('URL;VALUE=URI:')
    expect(ics).toContain('STATUS:CONFIRMED')

    // 无 eventAt 的条目不应出现在日历中
    expect(buildIcal(items, meta)).not.toContain('UID:post-1@gbc-news')

    // 日文长标题应按 UTF-8 字节折行，不能整行超长
    const longTitleItem: NewsItem = {
      ...items[0]!,
      id: 'post-long',
      eventAt: '2026-09-06T00:00:00.000Z',
      title:
        '劇場版総集編「ガールズバンドクライ」【前編】青春狂走曲（初回限定版）/【後編】なぁ、未来。（初回限定版）特典CD楽曲の試聴動画を公開！',
    }
    const longIcs = buildIcal([longTitleItem], meta)
    for (const line of longIcs.split('\r\n')) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75)
    }
  })
})
