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
      { date: '2026-06-23', kind: 'sale', startTime: '12:00' },
      { date: '2026-06-25', kind: 'sale', startTime: '12:00' },
      { date: '2026-06-26', kind: 'sale', startTime: '12:00' },
      { date: '2026-08-14', kind: 'hold', startTime: '19:30' },
      { date: '2026-08-16', kind: 'hold', startTime: '19:00' },
      { date: '2026-08-19', kind: 'hold', startTime: '20:00' },
    ])
  })

  it('解析開催日時中的完整年月日与跨日期间', () => {
    const text =
      'ASUTO MUSIC PARK 2026に出演決定！ ■開催日時 2026年9月5日(土)/6日(日) ※トゲナシトゲアリの出演は9月6日(日)'
    expect(extractEventDates(text, '', '2026-06-01T00:00:00.000Z')).toEqual([
      { date: '2026-09-05', endDate: '2026-09-06', kind: 'hold' },
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

  it('标题斜杠日期 + 開催：7/3よりカフェ', () => {
    expect(
      extractEventDates(
        '7/3(金)より『ガールズバンドクライ』アイスクリームガールズカフェ at 洒落CAFE 開催決定！',
        '',
        '2026-06-20T00:00:00.000Z',
      ),
    ).toEqual([{ date: '2026-07-03', kind: 'hold' }])
  })

  it('開催期間标签与出演决定短文中的跨日期间', () => {
    expect(
      extractEventDates(
        'コラボカフェ開催！',
        '■開催期間 東京：2026年4月4日(土)～5月10日(日)',
        '2026-03-20T00:00:00.000Z',
      ),
    ).toEqual([{ date: '2026-04-04', endDate: '2026-05-10', kind: 'hold' }])

    expect(
      extractEventDates(
        '「CON-CON HONG KONG 2026」出演決定！',
        '📅2026年4月4日-5日 AsiaWorld-Expo',
        '2026-02-10T00:00:00.000Z',
      ),
    ).toEqual([{ date: '2026-04-04', endDate: '2026-04-05', kind: 'hold' }])
  })

  it('带起止时刻的キャンペーン期间：跨日>24h 去掉时刻', () => {
    expect(
      extractEventDates(
        'フォロー＆リポストキャンペーン',
        '【開催期間】 10月23日（月）20:00 ～ 10月29日（日） 23:59',
        '2023-10-20T00:00:00.000Z',
      ),
    ).toEqual([
      {
        date: '2023-10-23',
        endDate: '2023-10-29',
        kind: 'hold',
      },
    ])
  })

  it('跨日但总时长≤24h 仍保留时刻', () => {
    expect(
      extractEventDates(
        '实况活动',
        '■開催日時 2024年6月14日(金) 23:00 ～ 2024年6月15日(土) 08:59',
        '2024-06-10T00:00:00.000Z',
      ),
    ).toEqual([
      {
        date: '2024-06-14',
        endDate: '2024-06-15',
        kind: 'hold',
        startTime: '23:00',
        endTime: '08:59',
      },
    ])
  })

  it('Tour 离散场次不合并为期间', () => {
    expect(
      extractEventDates(
        'Zepp Tour 開催',
        '■日程 2月11日、2月14日、2月23日',
        '2026-01-10T00:00:00.000Z',
      ),
    ).toEqual([
      { date: '2026-02-11', kind: 'hold' },
      { date: '2026-02-14', kind: 'hold' },
      { date: '2026-02-23', kind: 'hold' },
    ])
  })

  it('販売開始日時为 sale，标题公演日为 hold', () => {
    expect(
      extractEventDates(
        'Zepp Tour 2026 3月14日（土）東京公演',
        '■販売開始日時：2026年3月7日(土)18:00〜',
        '2026-03-01T00:00:00.000Z',
      ),
    ).toEqual([
      { date: '2026-03-07', kind: 'sale', startTime: '18:00' },
      { date: '2026-03-14', kind: 'hold' },
    ])
  })

  it('開場/開演写入 startTime（开演时刻）', () => {
    expect(
      extractEventDates(
        'LIVE 開催決定',
        '■開催日時 2026年5月1日（金） OPEN 18:00 / START 19:00 東京ガーデンシアター',
        '2026-03-01T00:00:00.000Z',
      ),
    ).toEqual([{ date: '2026-05-01', kind: 'hold', startTime: '19:00' }])
  })

  it('一部/二部开演生成同日多条时刻', () => {
    expect(
      extractEventDates(
        'Canna Lily LIVE',
        '■開催日時 2026年9月5日(土) 一部:開場14:00/開演 15:00 二部:開場 18:30/開演 19:30',
        '2026-05-01T00:00:00.000Z',
      ),
    ).toEqual([
      { date: '2026-09-05', kind: 'hold', startTime: '15:00' },
      { date: '2026-09-05', kind: 'hold', startTime: '19:30' },
    ])
  })

  it('スタート＋終了予定合并为一条起止，不拆成两次开演', () => {
    expect(
      extractEventDates(
        'オンライントーク配信開催決定',
        '▼開催日時 2026年3月27日(金) 19時スタート （20時終了予定）',
        '2026-03-01T00:00:00.000Z',
      ),
    ).toEqual([{ date: '2026-03-27', kind: 'hold', startTime: '19:00', endTime: '20:00' }])
  })
})
