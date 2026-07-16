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

  it('有 startTime 时输出 UTC DATE-TIME，缺省结束按 hold+2h', () => {
    const timed: NewsItem = {
      ...item,
      id: 'post-timed',
      eventDates: [{ date: '2026-05-01', kind: 'hold', startTime: '19:00' }],
    }
    const entries = expandEventDates([timed])
    expect(entries[0]?.occurredOn).toBe('2026-05-01T10:00:00.000Z') // 19:00 JST
    expect(entries[0]?.endAt).toBe('2026-05-01T12:00:00.000Z') // +2h
    expect(entries[0]?.entryId).toBe('post-timed-2026-05-01-hold-1900')

    const ics = buildIcal(entries, meta)
    expect(ics).toContain('DTSTART:20260501T100000Z')
    expect(ics).toContain('DTEND:20260501T120000Z')
    expect(ics).toContain('TRANSP:OPAQUE')
    expect(ics).not.toContain('DTSTART;VALUE=DATE:20260501')
  })

  it('iCal DESCRIPTION 与 URL 保留完整原始链接（不被截断）', () => {
    const longUrl =
      'https://girls-band-cry.com/news/post-999.html?utm_source=calendar&utm_campaign=very-long-tracking-parameter-should-stay-intact'
    const longSummary =
      '平素より格別のご愛顧を賜り、誠にありがとうございます。詳細は公式サイトをご確認ください。'.repeat(
        4,
      )
    const withLong = {
      ...item,
      id: 'post-url',
      url: longUrl,
      summary: longSummary,
      eventDates: [{ date: '2026-09-06', kind: 'hold' as const }],
    }
    const ics = buildIcal(expandEventDates([withLong]), meta)
    // DESCRIPTION / URL 可能按 RFC5545 折行，展开后再断言完整链接
    const unfolded = ics.replace(/\r\n[ \t]/g, '')
    expect(unfolded).toContain(`URL;VALUE=URI:${longUrl}`)
    expect(unfolded).toContain(longUrl)
    expect(unfolded).not.toMatch(
      /https:\/\/girls-band-cry\.com\/news\/post-999\.html\?utm_source=cal…/,
    )
  })

  it('iCal 折行不切断 URL，且 DESCRIPTION 去掉摘要外链', () => {
    const articleUrl = 'https://girls-band-cry.com/news/post-458.html'
    const withForeign = {
      ...item,
      id: 'post-458',
      url: articleUrl,
      summary:
        '香港イベント出演決定！ 詳細 https://con-con.asia/en/klook20260210.aspx および X： https://x.com/rockinjapan をご確認ください。'.repeat(
          2,
        ),
      eventDates: [{ date: '2026-04-04', kind: 'hold' as const }],
    }
    const ics = buildIcal(expandEventDates([withForeign]), meta)
    expect(ics).not.toMatch(/klook20260210\.\r\n aspx/)
    expect(ics).not.toMatch(/news\/post\r\n -\d/)
    expect(ics).not.toContain('con-con.asia')
    expect(ics).not.toContain('x.com/rock')

    const unfolded = ics.replace(/\r\n[ \t]/g, '')
    expect(unfolded).toContain(articleUrl)
    expect(unfolded).toContain(`URL;VALUE=URI:${articleUrl}`)

    // 任一物理行若含 https://，则该行内 URL 应完整（不被折到下一行）
    for (const line of ics.split('\r\n')) {
      const idx = line.indexOf('https://')
      if (idx < 0) continue
      const fromHttp = line.slice(idx).trimEnd()
      expect(fromHttp.startsWith('https://')).toBe(true)
      expect(fromHttp.includes(' ')).toBe(false)
    }
  })
})
