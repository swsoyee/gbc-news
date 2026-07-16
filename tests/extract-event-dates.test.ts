import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { extractEventDates } from '../src/categories/extract-event-dates.js'
import { parseNewsDetail } from '../src/scrapers/gbc-news/parse-detail.js'

const fixtures = join(dirname(fileURLToPath(import.meta.url)), '../src/scrapers/gbc-news/fixtures')

describe('extractEventDates', () => {
  it('从 post-480 抽取多日程与售票日（省略年 + kind）', () => {
    const html = readFileSync(join(fixtures, 'detail-post-480.html'), 'utf8')
    const detail = parseNewsDetail(html)
    const dates = extractEventDates(detail.title, detail.bodyText, detail.publishedAt)

    expect(dates).toEqual([
      { date: '2026-06-23', kind: 'sale' },
      { date: '2026-06-25', kind: 'sale' },
      { date: '2026-06-26', kind: 'sale' },
      { date: '2026-08-14', kind: 'hold' },
      { date: '2026-08-16', kind: 'hold' },
      { date: '2026-08-19', kind: 'hold' },
    ])
  })

  it('解析開催日時中的完整年月日与跨日', () => {
    const text =
      'ASUTO MUSIC PARK 2026に出演決定！ ■開催日時 2026年9月5日(土)/6日(日) ※トゲナシトゲアリの出演は9月6日(日)'
    expect(extractEventDates(text, '', '2026-06-01T00:00:00.000Z')).toEqual([
      { date: '2026-09-05', kind: 'hold' },
      { date: '2026-09-06', kind: 'hold' },
    ])
  })

  it('优先出演日标签为 hold', () => {
    const body = '■開催日 2026年9月12日(土) ■トゲナシトゲアリ出演日 2026年9月19日(土)'
    expect(extractEventDates('ROCK IN JAPAN', body, '2026-05-20T00:00:00.000Z')).toEqual([
      { date: '2026-09-12', kind: 'hold' },
      { date: '2026-09-19', kind: 'hold' },
    ])
  })

  it('D9：省略年倒退接近一年（跨年）则 +1 年', () => {
    // 发布 2026-02-01，省略年「1月5日」→ 倒退约 27 天，不 +1
    expect(extractEventDates('■日程：1月5日', '', '2026-02-01T00:00:00.000Z')).toEqual([
      { date: '2026-01-05', kind: 'hold' },
    ])
    // 发布 2026-12-20，「1月5日」→ 2026-01-05 倒退约 349 天 → +1 → 2027-01-05
    expect(extractEventDates('■日程：1月5日', '', '2026-12-20T00:00:00.000Z')).toEqual([
      { date: '2027-01-05', kind: 'hold' },
    ])
  })

  it('排除営業日相对措辞', () => {
    expect(
      extractEventDates(
        '発送について',
        '最大5営業日以内に発送します。',
        '2026-07-01T00:00:00.000Z',
      ),
    ).toEqual([])
  })

  it('无标签日期时返回空', () => {
    expect(
      extractEventDates('展開図公開！', '展開図を公開いたします！', '2026-07-15T00:00:00.000Z'),
    ).toEqual([])
  })
})
