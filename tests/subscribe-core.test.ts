import { describe, expect, it } from 'vitest'
import {
  buildCalendarEvents,
  buildDayTimedBlocks,
  buildFeedUrls,
  buildMonthCells,
  buildWeekSegments,
  chipLabel,
  displayNewsTitle,
  EARLY_HOURS,
  earlyHoursFrameVars,
  formatMonthLabel,
  formatTimeRangeLabel,
  isAllDayEvent,
  layoutTimedLanes,
  resolveEventWallRange,
  shiftMonth,
  startOfWeek,
  timedBlockStyle,
  timedBlockStyleWithEarlyToggle,
  toIsoDate,
  toWebcal,
  resolveTheme,
} from '../src/web/subscribe-core.js'

describe('resolveTheme', () => {
  it('优先使用已存储的主题', () => {
    expect(resolveTheme('light', false)).toBe('light')
    expect(resolveTheme('dark', true)).toBe('dark')
  })

  it('无有效存储时跟随系统浅色偏好', () => {
    expect(resolveTheme(null, true)).toBe('light')
    expect(resolveTheme('invalid', false)).toBe('dark')
  })
})

describe('buildFeedUrls', () => {
  const base = {
    origin: 'https://example.com',
    groupCount: 4,
    categoryCount: 7,
  }

  it('全选时走静态 all feeds', () => {
    expect(
      buildFeedUrls({
        ...base,
        groups: ['togenashi', 'f272', 'canna-lily', 'other'],
        categories: ['live', 'event', 'goods', 'music', 'cinema', 'media', 'other'],
      }),
    ).toEqual({
      mode: 'all',
      rss: 'https://example.com/feeds/all.xml',
      ics: 'https://example.com/feeds/all.ics',
    })
  })

  it('单分类走静态分类 feed，并附 ICS 版本参数', () => {
    const result = buildFeedUrls({
      ...base,
      groups: ['togenashi', 'f272', 'canna-lily', 'other'],
      categories: ['live'],
      feedRev: '2026-07-01',
    })
    expect(result.mode).toBe('category')
    expect(result.rss).toBe('https://example.com/feeds/live.xml')
    expect(result.ics).toContain('/feeds/live.ics')
    expect(result.ics).toContain('v=2026-07-01')
  })

  it('组合过滤走动态 API', () => {
    const result = buildFeedUrls({
      ...base,
      groups: ['togenashi', 'f272'],
      categories: ['live', 'goods'],
    })
    expect(result.mode).toBe('api')
    expect(result.rss).toContain('/api/feed?')
    expect(result.rss).toContain('groups=togenashi%2Cf272')
    expect(result.rss).toContain('categories=live%2Cgoods')
    expect(result.ics).toContain('format=ics')
  })
})

describe('calendar helpers', () => {
  it('toIsoDate / startOfWeek / shiftMonth 按本地日计算', () => {
    const day = new Date(2026, 6, 15) // Jul 15 2026 Wed
    expect(toIsoDate(day)).toBe('2026-07-15')
    expect(toIsoDate(startOfWeek(day))).toBe('2026-07-13') // Monday
    expect(toIsoDate(shiftMonth(day, 1))).toBe('2026-08-15')
    expect(formatMonthLabel(day)).toBe('2026年7月')
  })

  it('buildMonthCells 生成 42 格且周一开头', () => {
    const cells = buildMonthCells(new Date(2026, 6, 1))
    expect(cells).toHaveLength(42)
    expect(cells[0]?.date).toBe('2026-06-29')
    expect(cells.filter((cell) => cell.inMonth)).toHaveLength(31)
  })

  it('跨日事件在周视图切成连续 segment', () => {
    const item = {
      title: 'Tour',
      url: 'https://example.com/1',
      groups: ['togenashi'],
      categories: ['live'],
      eventDates: [{ date: '2026-07-14', endDate: '2026-07-16', kind: 'hold' as const }],
    }
    const events = buildCalendarEvents([item], ['togenashi'], ['live'], 4, 7)
    expect(events).toHaveLength(1)

    const weekCells = [
      { date: '2026-07-13', dayNum: 13, inMonth: true, isRestDay: false },
      { date: '2026-07-14', dayNum: 14, inMonth: true, isRestDay: false },
      { date: '2026-07-15', dayNum: 15, inMonth: true, isRestDay: false },
      { date: '2026-07-16', dayNum: 16, inMonth: true, isRestDay: false },
      { date: '2026-07-17', dayNum: 17, inMonth: true, isRestDay: false },
      { date: '2026-07-18', dayNum: 18, inMonth: true, isRestDay: true },
      { date: '2026-07-19', dayNum: 19, inMonth: true, isRestDay: true },
    ]
    const segments = buildWeekSegments(events, weekCells)
    expect(segments).toHaveLength(1)
    expect(segments[0]).toMatchObject({
      startColumn: 1,
      endColumn: 3,
      continuesBefore: false,
      continuesAfter: false,
      lane: 0,
    })
    expect(chipLabel(segments[0]!)).toBe('開催 Tour')
  })

  it('日历标题优先使用中文增强字段', () => {
    const item = {
      title: 'ライブ',
      titleZh: '演出',
      url: 'https://example.com/zh',
      eventDates: [{ date: '2026-07-14', kind: 'hold' as const }],
    }
    const event = buildCalendarEvents([item], [], [], 4, 7)[0]!
    expect(displayNewsTitle(event.item)).toBe('演出')
    expect(chipLabel({ event, continuesBefore: false, continuesAfter: false })).toBe('開催 演出')
  })

  it('toWebcal 转换协议', () => {
    expect(toWebcal('https://example.com/a.ics')).toBe('webcal://example.com/a.ics')
  })
})

describe('timed event helpers', () => {
  const baseItem = {
    title: 'Live',
    url: 'https://example.com/1',
    groups: ['togenashi'],
    categories: ['live'],
  }

  it('透传 endTime，缺省时 hold 补 +2h', () => {
    const withEnd = buildCalendarEvents(
      [
        {
          ...baseItem,
          eventDates: [{ date: '2026-07-14', kind: 'hold', startTime: '19:00', endTime: '21:30' }],
        },
      ],
      ['togenashi'],
      ['live'],
      4,
      7,
    )
    expect(withEnd[0]).toMatchObject({ startTime: '19:00', endTime: '21:30' })
    expect(resolveEventWallRange(withEnd[0]!)).toEqual({
      startDate: '2026-07-14',
      startTime: '19:00',
      endDate: '2026-07-14',
      endTime: '21:30',
    })

    const openOnly = buildCalendarEvents(
      [
        {
          ...baseItem,
          eventDates: [{ date: '2026-07-14', kind: 'hold', startTime: '19:00' }],
        },
      ],
      ['togenashi'],
      ['live'],
      4,
      7,
    )
    expect(resolveEventWallRange(openOnly[0]!)).toEqual({
      startDate: '2026-07-14',
      startTime: '19:00',
      endDate: '2026-07-14',
      endTime: '21:00',
    })
  })

  it('跨日裁剪到当天分钟区间', () => {
    const events = buildCalendarEvents(
      [
        {
          ...baseItem,
          eventDates: [
            {
              date: '2026-07-14',
              endDate: '2026-07-15',
              kind: 'hold',
              startTime: '22:00',
              endTime: '02:00',
            },
          ],
        },
      ],
      ['togenashi'],
      ['live'],
      4,
      7,
    )
    const day1 = buildDayTimedBlocks(events, '2026-07-14')
    expect(day1).toHaveLength(1)
    expect(day1[0]).toMatchObject({
      startMin: 22 * 60,
      endMin: 1440,
      continuesBefore: false,
      continuesAfter: true,
    })
    const day2 = buildDayTimedBlocks(events, '2026-07-15')
    expect(day2[0]).toMatchObject({
      startMin: 0,
      endMin: 2 * 60,
      continuesBefore: true,
      continuesAfter: false,
    })
  })

  it('重叠事件分 lane，并生成定位样式', () => {
    const events = buildCalendarEvents(
      [
        {
          ...baseItem,
          title: 'A',
          eventDates: [{ date: '2026-07-14', kind: 'hold', startTime: '18:00', endTime: '20:00' }],
        },
        {
          ...baseItem,
          title: 'B',
          eventDates: [{ date: '2026-07-14', kind: 'hold', startTime: '19:00', endTime: '21:00' }],
        },
      ],
      ['togenashi'],
      ['live'],
      4,
      7,
    )
    const laid = layoutTimedLanes(buildDayTimedBlocks(events, '2026-07-14'))
    expect(laid.map((b) => b.lane)).toEqual([0, 1])
    const style = timedBlockStyle(laid[1]!, 2)
    expect(style.left).toBe('calc(50% + 1px)')
    expect(style.width).toBe('calc(50% - 2px)')
    expect(formatTimeRangeLabel('19:00', '21:00')).toBe('19:00–21:00')
  })

  it('仅有 23:59 时显示为当日 23:00–23:59', () => {
    const events = buildCalendarEvents(
      [
        {
          ...baseItem,
          categories: ['goods'],
          eventDates: [{ date: '2026-07-18', kind: 'sale', startTime: '23:59' }],
        },
      ],
      ['togenashi'],
      ['goods'],
      4,
      7,
    )
    expect(resolveEventWallRange(events[0]!)).toEqual({
      startDate: '2026-07-18',
      startTime: '23:00',
      endDate: '2026-07-18',
      endTime: '23:59',
    })
    const blocks = buildDayTimedBlocks(events, '2026-07-18')
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toMatchObject({ startMin: 23 * 60, endMin: 23 * 60 + 59 })
    expect(buildDayTimedBlocks(events, '2026-07-19')).toHaveLength(0)
  })

  it('缺省时长跨午夜时只画到当日 24:00，不拆成次日色块', () => {
    const events = buildCalendarEvents(
      [
        {
          ...baseItem,
          eventDates: [{ date: '2026-07-14', kind: 'hold', startTime: '23:00' }],
        },
      ],
      ['togenashi'],
      ['live'],
      4,
      7,
    )
    expect(resolveEventWallRange(events[0]!)).toEqual({
      startDate: '2026-07-14',
      startTime: '23:00',
      endDate: '2026-07-14',
      endTime: '24:00',
    })
    expect(buildDayTimedBlocks(events, '2026-07-14')[0]).toMatchObject({
      startMin: 23 * 60,
      endMin: 1440,
    })
    expect(buildDayTimedBlocks(events, '2026-07-15')).toHaveLength(0)
  })

  it('无 startTime 视为全天事件', () => {
    const events = buildCalendarEvents(
      [
        {
          ...baseItem,
          eventDates: [{ date: '2026-07-14', kind: 'hold' }],
        },
      ],
      ['togenashi'],
      ['live'],
      4,
      7,
    )
    expect(isAllDayEvent(events[0]!)).toBe(true)
    expect(resolveEventWallRange(events[0]!)).toBeNull()
  })

  it('凌晨折叠：CSS 变量与跨越 8:00 边界的色块补偿一致', () => {
    expect(EARLY_HOURS).toBe(8)
    expect(earlyHoursFrameVars(false)).toEqual({
      earlyHours: '8',
      earlyOffset: '8',
      visibleHours: '16',
    })
    expect(earlyHoursFrameVars(true)).toEqual({
      earlyHours: '8',
      earlyOffset: '0',
      visibleHours: '24',
    })

    const events = buildCalendarEvents(
      [
        {
          ...baseItem,
          title: 'Before',
          eventDates: [{ date: '2026-07-14', kind: 'hold', startTime: '06:00', endTime: '07:00' }],
        },
        {
          ...baseItem,
          title: 'Span',
          eventDates: [{ date: '2026-07-14', kind: 'hold', startTime: '07:30', endTime: '09:00' }],
        },
        {
          ...baseItem,
          title: 'After',
          eventDates: [{ date: '2026-07-14', kind: 'hold', startTime: '10:00', endTime: '11:00' }],
        },
      ],
      ['togenashi'],
      ['live'],
      4,
      7,
    )
    const blocks = layoutTimedLanes(buildDayTimedBlocks(events, '2026-07-14'))
    const before = blocks.find((b) => b.event.item.title === 'Before')!
    const span = blocks.find((b) => b.event.item.title === 'Span')!
    const after = blocks.find((b) => b.event.item.title === 'After')!

    expect(timedBlockStyleWithEarlyToggle(before, 1).top).toContain('+ 0px')
    expect(timedBlockStyleWithEarlyToggle(before, 1).height).toContain('+ 0px')
    expect(timedBlockStyleWithEarlyToggle(span, 1).height).toContain('var(--toggle-row-height)')
    expect(timedBlockStyleWithEarlyToggle(after, 1).top).toContain('var(--toggle-row-height)')
  })
})
