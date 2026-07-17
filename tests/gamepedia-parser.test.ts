import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { extractGamepediaEventDates } from '../src/scrapers/gamepedia/extract-dates.js'
import { classifyGamepedia } from '../src/scrapers/gamepedia/index.js'
import { parseNewsDetail } from '../src/scrapers/gamepedia/parse-detail.js'
import { parseNewsList } from '../src/scrapers/gamepedia/parse-list.js'
import { itemIdFromUrl, listPageUrl } from '../src/scrapers/gamepedia/urls.js'

const fixtures = join(dirname(fileURLToPath(import.meta.url)), '../src/scrapers/gamepedia/fixtures')

describe('gamepedia urls', () => {
  it('生成搜索列表 URL 与 id', () => {
    expect(listPageUrl(1)).toContain('?s=')
    expect(listPageUrl(2)).toContain('/page/2?')
    expect(itemIdFromUrl('https://premium.gamepedia.jp/hobby/archives/205942')).toBe(
      'gamepedia-205942',
    )
  })
})

describe('gamepedia parseNewsList', () => {
  it('解析搜索列表页（仅 archives 文章）', () => {
    const html = readFileSync(join(fixtures, 'list-page-1.html'), 'utf8')
    const items = parseNewsList(html)
    expect(items.length).toBe(10)
    expect(items[0]).toMatchObject({
      id: 'gamepedia-205942',
      url: 'https://premium.gamepedia.jp/hobby/archives/205942',
    })
    expect(items[0]?.title).toContain('タワレコ')
    expect(items.every((item) => item.id.startsWith('gamepedia-'))).toBe(true)
  })
})

describe('gamepedia parseNewsDetail', () => {
  it('解析 POP UP 多店開催期間', () => {
    const html = readFileSync(join(fixtures, 'detail-popup.html'), 'utf8')
    const detail = parseNewsDetail(html)
    expect(detail.title).toContain('タワレコ')
    expect(detail.publishedAt).toBe('2026-07-15T05:03:03.000Z')
    expect(detail.bodyText).toContain('開催期間')
    expect(detail.imageUrl).toBeTruthy()

    const dates = extractGamepediaEventDates({
      title: detail.title,
      bodyText: detail.bodyText,
      publishedAt: detail.publishedAt,
    })
    expect(dates).toEqual(
      expect.arrayContaining([
        { date: '2026-08-07', endDate: '2026-08-16', kind: 'hold' },
        { date: '2026-09-04', endDate: '2026-09-13', kind: 'hold' },
      ]),
    )
    expect(classifyGamepedia(detail.title, detail.bodyText)).toEqual(
      expect.arrayContaining(['goods', 'event']),
    )
  })

  it('解析グッズ预约相关日为 sale', () => {
    const html = readFileSync(join(fixtures, 'detail-goods.html'), 'utf8')
    const detail = parseNewsDetail(html)
    expect(detail.title).toContain('甚平')
    const dates = extractGamepediaEventDates({
      title: detail.title,
      bodyText: detail.bodyText,
      publishedAt: detail.publishedAt,
    })
    expect(dates.length).toBeGreaterThan(0)
    expect(dates.some((entry) => entry.kind === 'sale' || entry.kind === 'hold')).toBe(true)
    expect(classifyGamepedia(detail.title, detail.bodyText)).toContain('goods')
  })

  it('解析コラボカフェ開催期間', () => {
    const html = readFileSync(join(fixtures, 'detail-cafe.html'), 'utf8')
    const detail = parseNewsDetail(html)
    expect(detail.title).toContain('カフェ')
    const dates = extractGamepediaEventDates({
      title: detail.title,
      bodyText: detail.bodyText,
      publishedAt: detail.publishedAt,
    })
    expect(dates).toEqual(
      expect.arrayContaining([{ date: '2026-07-03', endDate: '2026-07-20', kind: 'hold' }]),
    )
    expect(classifyGamepedia(detail.title, detail.bodyText)).toEqual(
      expect.arrayContaining(['goods', 'event']),
    )
  })
})
