import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { classifyText } from '../src/categories/classify.js'
import { classifyGroupsForSource } from '../src/categories/classify-group.js'
import { extractEventDates } from '../src/categories/extract-event-dates.js'
import { parseNewsDetail } from '../src/scrapers/gbc-firstriff/parse.js'
import { parseNewsList } from '../src/scrapers/gbc-firstriff/parse-list.js'

const fixtures = join(
  dirname(fileURLToPath(import.meta.url)),
  '../src/scrapers/gbc-firstriff/fixtures',
)

describe('firstriff parseNewsList', () => {
  it('解析列表页', () => {
    const html = readFileSync(join(fixtures, 'list-page-1.html'), 'utf8')
    const items = parseNewsList(html)
    expect(items.length).toBe(6)
    expect(items[0]).toMatchObject({
      id: 'firstriff-post-6',
      url: 'https://gbc-firstriff.com/news/post-6.html',
      publishedAt: '2026-07-01T00:00:00.000Z',
    })
    expect(items[0]?.title).toContain('Canna Lily')
  })
})

describe('firstriff parseNewsDetail', () => {
  it('解析详情与活动日/组合', () => {
    const html = readFileSync(join(fixtures, 'detail-post-5.html'), 'utf8')
    const detail = parseNewsDetail(html)
    expect(detail.title).toContain('枯れ歌の情景')
    expect(detail.publishedAt).toBe('2026-06-26T00:00:00.000Z')
    expect(extractEventDates(detail.title, detail.bodyText, detail.publishedAt)).toEqual([
      { date: '2026-09-05', kind: 'hold', startTime: '15:00' },
      { date: '2026-09-05', kind: 'hold', startTime: '19:30' },
    ])
    expect(classifyGroupsForSource('gbc-firstriff', detail.title, detail.bodyText)).toEqual([
      'canna-lily',
    ])
    expect(classifyText(detail.title, detail.bodyText)).toContain('live')
  })

  it('F-272 详情识别组合与開催日', () => {
    const html = readFileSync(join(fixtures, 'detail-post-3.html'), 'utf8')
    const detail = parseNewsDetail(html)
    expect(classifyGroupsForSource('gbc-firstriff', detail.title, detail.bodyText)).toEqual([
      'f272',
    ])
    expect(extractEventDates(detail.title, detail.bodyText, detail.publishedAt)).toContainEqual({
      date: '2026-07-20',
      kind: 'hold',
      startTime: '17:00',
    })
  })
})
