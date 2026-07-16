import { describe, expect, it } from 'vitest'
import { extractEventSchedule } from '../src/utils/event-time.js'

describe('extractEventSchedule', () => {
  it('解析開催日時中的完整年月日', () => {
    const text =
      'ASUTO MUSIC PARK 2026に出演決定！ ■開催日時 2026年9月5日(土)/6日(日) ※トゲナシトゲアリの出演は9月6日(日)'
    const schedule = extractEventSchedule(text, '', '2026-06-01T00:00:00.000Z')
    expect(schedule?.eventAt).toBe('2026-09-05T00:00:00.000Z')
    expect(schedule?.eventEndAt).toBe('2026-09-06T00:00:00.000Z')
  })

  it('优先出演日标签', () => {
    const body =
      '■開催日 2026年9月12日(土)・13日(日)／19日(土)・20日(日)・21日(月・祝) ■トゲナシトゲアリ出演日 2026年9月19日(土)'
    const schedule = extractEventSchedule('ROCK IN JAPAN', body, '2026-05-20T00:00:00.000Z')
    expect(schedule?.eventAt).toBe('2026-09-19T00:00:00.000Z')
  })

  it('解析标题中的 M/D より', () => {
    const schedule = extractEventSchedule(
      '7/3(金)より『ガールズバンドクライ』アイスクリームガールズカフェ at 洒落CAFE 開催決定！',
      '',
      '2026-06-18T00:00:00.000Z',
    )
    expect(schedule).toEqual({ eventAt: '2026-07-03T00:00:00.000Z' })
  })

  it('解析発売日', () => {
    const body = '＜発売日＞ AniBirthショップ：2026年6月28日(日) 東映：2026年6月29日(月)13時'
    const schedule = extractEventSchedule(
      '2026年ルパ誕生日グッズ',
      body,
      '2026-06-22T00:00:00.000Z',
    )
    expect(schedule?.eventAt).toBe('2026-06-28T00:00:00.000Z')
    expect(schedule?.eventEndAt).toBe('2026-06-29T00:00:00.000Z')
  })

  it('无发生日时返回 null', () => {
    expect(
      extractEventSchedule('展開図公開！', '展開図を公開いたします！', '2026-07-15T00:00:00.000Z'),
    ).toBeNull()
  })
})
