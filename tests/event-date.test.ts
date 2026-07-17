import { describe, expect, it } from 'vitest'
import {
  assertEventDate,
  eventSpanExceeds24Hours,
  normalizeEventDate,
} from '../src/models/event-date.js'

describe('normalizeEventDate / 跨日>24h 去时刻', () => {
  it('长跨日带时刻应剥掉时刻', () => {
    const entry = {
      date: '2023-10-23',
      endDate: '2023-10-29',
      kind: 'hold' as const,
      startTime: '20:00',
      endTime: '23:59',
    }
    expect(eventSpanExceeds24Hours(entry)).toBe(true)
    expect(normalizeEventDate(entry)).toEqual({
      date: '2023-10-23',
      endDate: '2023-10-29',
      kind: 'hold',
    })
  })

  it('跨夜但≤24h 保留时刻', () => {
    const entry = {
      date: '2024-06-14',
      endDate: '2024-06-15',
      kind: 'hold' as const,
      startTime: '23:00',
      endTime: '08:59',
    }
    expect(eventSpanExceeds24Hours(entry)).toBe(false)
    expect(normalizeEventDate(entry)).toEqual(entry)
  })

  it('assertEventDate 拒绝超 24h 仍带时刻的记录', () => {
    expect(() =>
      assertEventDate({
        date: '2023-10-23',
        endDate: '2023-10-29',
        kind: 'hold',
        startTime: '20:00',
        endTime: '23:59',
      }),
    ).toThrow(/more than 24 hours/)
  })
})
