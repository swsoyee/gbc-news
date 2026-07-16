import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { classifyCollabo } from '../src/categories/classify-collabo.js'
import { extractCollaboEventDates } from '../src/scrapers/collabo-cafe/extract-dates.js'
import { parseNewsDetail } from '../src/scrapers/collabo-cafe/parse-detail.js'
import { parseNewsList } from '../src/scrapers/collabo-cafe/parse-list.js'
import { itemIdFromUrl, listPageUrl } from '../src/scrapers/collabo-cafe/urls.js'

const fixtures = join(
  dirname(fileURLToPath(import.meta.url)),
  '../src/scrapers/collabo-cafe/fixtures',
)

describe('collabo-cafe urls', () => {
  it('生成搜索列表 URL 与 id', () => {
    expect(listPageUrl(1)).toContain('?s=')
    expect(listPageUrl(2)).toContain('/page/2/')
    expect(
      itemIdFromUrl(
        'https://collabo-cafe.com/events/collabo/girls-band-cry-scream-cafe-treevillage-2026/',
      ),
    ).toBe('collabo-girls-band-cry-scream-cafe-treevillage-2026')
  })
})

describe('collabo-cafe parseNewsList', () => {
  it('解析搜索列表页', () => {
    const html = readFileSync(join(fixtures, 'list-page-1.html'), 'utf8')
    const items = parseNewsList(html)
    expect(items.length).toBe(16)
    expect(items[0]).toMatchObject({
      id: 'collabo-girls-band-cry-goodsmile-moment-anime-store-goods2026',
      url: 'https://collabo-cafe.com/events/collabo/girls-band-cry-goodsmile-moment-anime-store-goods2026/',
      publishedAt: '2026-07-11T00:00:00.000Z',
    })
    expect(items[0]?.title).toContain('グッズ')
    expect(items[0]?.eventCategories).toContain('goods')
    expect(items[0]?.eventDateText).toContain('予約受付')
    expect(items.some((item) => item.eventCategories.includes('cafe'))).toBe(true)
  })
})

describe('collabo-cafe parseNewsDetail', () => {
  it('解析 SCREAM カフェ多城市開催期間', () => {
    const html = readFileSync(join(fixtures, 'detail-scream-cafe.html'), 'utf8')
    const detail = parseNewsDetail(html)
    expect(detail.title).toContain('SCREAM')
    expect(detail.publishedAt).toBe('2026-03-23T08:40:44.000Z')
    expect(detail.ccTable['開催期間']).toContain('東京')
    expect(detail.ccTable['開催期間']).toContain('横浜')
    expect(detail.imageUrl).toContain('wp-content/uploads')

    const dates = extractCollaboEventDates({
      title: detail.title,
      bodyText: detail.bodyText,
      publishedAt: detail.publishedAt,
      ccTable: detail.ccTable,
    })
    expect(dates).toEqual(
      expect.arrayContaining([
        { date: '2026-04-04', endDate: '2026-04-17', kind: 'hold' },
        { date: '2026-04-24', endDate: '2026-05-15', kind: 'hold' },
        { date: '2026-06-06', endDate: '2026-06-18', kind: 'hold' },
      ]),
    )
    expect(classifyCollabo(detail.title, detail.bodyText, ['cafe'])).toContain('event')
  })

  it('解析グッズ预约截止为 sale', () => {
    const html = readFileSync(join(fixtures, 'detail-goods.html'), 'utf8')
    const detail = parseNewsDetail(html)
    expect(detail.title).toContain('グッズ')
    expect(detail.ccTable['予約期間']).toContain('7月18日')

    const dates = extractCollaboEventDates({
      title: detail.title,
      bodyText: detail.bodyText,
      publishedAt: detail.publishedAt,
      ccTable: detail.ccTable,
      listEventDateText: '～2026年7月18日まで予約受付',
    })
    expect(dates.some((d) => d.kind === 'sale' && d.date === '2026-07-18')).toBe(true)
    expect(classifyCollabo(detail.title, detail.bodyText, ['goods'])).toContain('goods')
  })

  it('解析单店カフェ開催期間', () => {
    const html = readFileSync(join(fixtures, 'detail-cafe.html'), 'utf8')
    const detail = parseNewsDetail(html)
    expect(detail.title).toContain('洒落CAFE')
    const dates = extractCollaboEventDates({
      title: detail.title,
      bodyText: detail.bodyText,
      publishedAt: detail.publishedAt,
      ccTable: detail.ccTable,
      listEventDateText: '期間 : 2026年7月3日〜7月20日',
    })
    expect(dates).toContainEqual({ date: '2026-07-03', endDate: '2026-07-20', kind: 'hold' })
    expect(classifyCollabo(detail.title, detail.bodyText, ['cafe'])).toEqual(
      expect.arrayContaining(['event']),
    )
  })
})

describe('classifyCollabo', () => {
  it('cafe 文含 event；goods 文含 goods；可并存', () => {
    expect(classifyCollabo('コラボカフェ開催', '', ['cafe'])).toContain('event')
    expect(classifyCollabo('新作グッズ予約受付', '', ['goods'])).toContain('goods')
    expect(classifyCollabo('カフェ限定グッズ発売', '', ['cafe', 'goods'])).toEqual(
      expect.arrayContaining(['event', 'goods']),
    )
  })
})
