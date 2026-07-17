export const EVENT_DATE_KINDS = ['hold', 'sale'] as const

export type EventDateKind = (typeof EVENT_DATE_KINDS)[number]

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

export interface EventDate {
  /** YYYY-MM-DD（Asia/Tokyo 日历日）开始日 */
  date: string
  kind: EventDateKind
  /** 跨日期间的结束日（含当日）；缺省 = 单日 */
  endDate?: string
  /** Asia/Tokyo 墙钟 HH:mm；缺省 = 全天事件 */
  startTime?: string
  /** Asia/Tokyo 墙钟 HH:mm；缺省且有 startTime 时由 feed 层补默认时长 */
  endTime?: string
}

export function isEventDateKind(value: string): value is EventDateKind {
  return (EVENT_DATE_KINDS as readonly string[]).includes(value)
}

function assertTime(label: string, value: unknown): asserts value is string {
  if (typeof value !== 'string' || !TIME_RE.test(value)) {
    throw new Error(`EventDate.${label} must be HH:mm, got: ${String(value)}`)
  }
}

export function assertEventDate(value: unknown): asserts value is EventDate {
  if (!value || typeof value !== 'object') {
    throw new Error('EventDate must be an object')
  }
  const entry = value as Record<string, unknown>
  if (typeof entry.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) {
    throw new Error(`EventDate.date must be YYYY-MM-DD, got: ${String(entry.date)}`)
  }
  if (typeof entry.kind !== 'string' || !isEventDateKind(entry.kind)) {
    throw new Error(`EventDate.kind must be hold|sale, got: ${String(entry.kind)}`)
  }
  if (entry.startTime !== undefined) assertTime('startTime', entry.startTime)
  if (entry.endTime !== undefined) assertTime('endTime', entry.endTime)
  if (entry.endTime !== undefined && entry.startTime === undefined) {
    throw new Error('EventDate.endTime requires startTime')
  }
  if (entry.endDate !== undefined) {
    if (typeof entry.endDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(entry.endDate)) {
      throw new Error(`EventDate.endDate must be YYYY-MM-DD, got: ${String(entry.endDate)}`)
    }
    if (entry.endDate < entry.date) {
      throw new Error(`EventDate.endDate must be >= date (${entry.date}..${entry.endDate})`)
    }
  }
}

export const EVENT_DATE_TITLE_PREFIX: Record<EventDateKind, string> = {
  hold: '[開催]',
  sale: '[発売]',
}

export const EVENT_DATE_TITLE_PREFIX_ZH: Record<EventDateKind, string> = {
  hold: '[举办]',
  sale: '[发售]',
}

/** hold 默认 2h，sale 默认 1h（分钟） */
export function defaultDurationMinutes(kind: EventDateKind): number {
  return kind === 'sale' ? 60 : 120
}

function hhmm(hour: number, minute: number): string {
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new Error(`Invalid time: ${hour}:${minute}`)
  }
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function ymd(year: number, month: number, day: number): string {
  const dt = new Date(Date.UTC(year, month - 1, day))
  if (dt.getUTCFullYear() !== year || dt.getUTCMonth() !== month - 1 || dt.getUTCDate() !== day) {
    throw new Error(`Invalid calendar date: ${year}-${month}-${day}`)
  }
  const m = String(month).padStart(2, '0')
  const d = String(day).padStart(2, '0')
  return `${year}-${m}-${d}`
}

function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  return ymd(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate())
}

function addMinutesToTime(time: string, minutes: number): { time: string; dayDelta: number } {
  const [hh, mm] = time.split(':').map(Number) as [number, number]
  const total = hh * 60 + mm + minutes
  const dayDelta = Math.floor(total / (24 * 60))
  const wrapped = ((total % (24 * 60)) + 24 * 60) % (24 * 60)
  return { time: hhmm(Math.floor(wrapped / 60), wrapped % 60), dayDelta }
}

/** Asia/Tokyo 墙钟 → UTC ISO（东京无夏令时，固定 UTC+9） */
export function tokyoWallToUtcIso(date: string, time: string): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  const [hh, mm] = time.split(':').map(Number) as [number, number]
  return new Date(Date.UTC(y, m - 1, d, hh - 9, mm, 0)).toISOString()
}

/** 有 startTime 时返回 UTC 起止；否则 null（全天，可能跨日由 expand 处理）。 */
export function eventDateToUtcRange(entry: EventDate): { startAt: string; endAt: string } | null {
  if (!entry.startTime) return null

  const startAt = tokyoWallToUtcIso(entry.date, entry.startTime)
  const endDay = entry.endDate ?? entry.date

  if (entry.endTime) {
    let endDate = endDay
    if (!entry.endDate && entry.endTime <= entry.startTime) endDate = addDays(entry.date, 1)
    return { startAt, endAt: tokyoWallToUtcIso(endDate, entry.endTime) }
  }

  if (entry.endDate && entry.endDate > entry.date) {
    // 跨日期间仅有开始时刻：结束日 23:59 JST
    return { startAt, endAt: tokyoWallToUtcIso(entry.endDate, '23:59') }
  }

  const { time, dayDelta } = addMinutesToTime(entry.startTime, defaultDurationMinutes(entry.kind))
  const endDate = dayDelta > 0 ? addDays(entry.date, dayDelta) : entry.date
  return { startAt, endAt: tokyoWallToUtcIso(endDate, time) }
}

/** 全天跨日：iCal DTEND 为结束日次日（不含）。 */
export function allDayExclusiveEndDate(entry: EventDate): string | null {
  if (entry.startTime) return null
  if (!entry.endDate || entry.endDate <= entry.date) return null
  return addDays(entry.endDate, 1)
}

export { addDays as addCalendarDays }
