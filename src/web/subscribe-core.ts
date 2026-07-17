export type CalendarView = 'month' | 'week' | 'day'

export interface CatalogItem {
  id: string
  label: string
}

export interface NewsItemLike {
  title: string
  url: string
  groups?: string[]
  categories?: string[]
  eventDates?: {
    date: string
    endDate?: string
    kind: 'hold' | 'sale'
    startTime?: string
  }[]
}

export interface CalendarEvent {
  item: NewsItemLike
  date: string
  endDate: string
  kind: 'hold' | 'sale'
  startTime?: string
}

export interface DayCell {
  date: string
  dayNum: number
  inMonth: boolean
  isRestDay: boolean
  holidayName?: string
}

export interface WeekSegment {
  event: CalendarEvent
  startColumn: number
  endColumn: number
  continuesBefore: boolean
  continuesAfter: boolean
  lane: number
}

export const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'] as const

export function toIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function mondayBasedWeekday(date: Date): number {
  return (date.getDay() + 6) % 7
}

export function startOfWeek(date: Date): Date {
  const day = startOfDay(date)
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() - mondayBasedWeekday(day))
}

export function shiftDay(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + delta)
}

export function shiftMonth(date: Date, delta: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth() + delta, 1)
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()
  return new Date(next.getFullYear(), next.getMonth(), Math.min(date.getDate(), lastDay))
}

export function formatMonthLabel(date: Date): string {
  return `${date.getFullYear()}年${date.getMonth() + 1}月`
}

export function formatWeekLabel(date: Date): string {
  const start = startOfWeek(date)
  const end = shiftDay(start, 6)
  const sameMonth = start.getMonth() === end.getMonth()
  if (sameMonth) {
    return `${start.getFullYear()}年${start.getMonth() + 1}月${start.getDate()}日–${end.getDate()}日`
  }
  return `${start.getMonth() + 1}月${start.getDate()}日–${end.getMonth() + 1}月${end.getDate()}日`
}

export function formatDayLabel(date: Date): string {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日（周${WEEKDAY_LABELS[date.getDay()]}）`
}

export function eventKindLabel(kind: 'hold' | 'sale'): string {
  return kind === 'sale' ? '発売' : '開催'
}

export function labelList(ids: string[], catalog: CatalogItem[]): string {
  if (ids.length === 0 || ids.length === catalog.length) return '全部'
  const map = Object.fromEntries(catalog.map((item) => [item.id, item.label]))
  return ids.map((id) => map[id] ?? id).join('、')
}

export function toWebcal(url: string): string {
  return url.replace(/^https:/, 'webcal:').replace(/^http:/, 'webcal:')
}

export function withFeedRev(url: string, feedRev: string): string {
  if (!feedRev) return url
  const parsed = new URL(url)
  parsed.searchParams.set('v', feedRev)
  return parsed.toString()
}

export function buildFeedUrls(options: {
  origin: string
  groups: string[]
  categories: string[]
  groupCount: number
  categoryCount: number
  feedRev?: string
}): { mode: 'all' | 'category' | 'group' | 'api'; rss: string; ics: string } {
  const { origin, groups, categories, groupCount, categoryCount, feedRev = '' } = options
  const allGroups = groups.length === 0 || groups.length === groupCount
  const allCategories = categories.length === 0 || categories.length === categoryCount

  if (allGroups && allCategories) {
    return {
      mode: 'all',
      rss: `${origin}/feeds/all.xml`,
      ics: withFeedRev(`${origin}/feeds/all.ics`, feedRev),
    }
  }

  if (allGroups && categories.length === 1) {
    const id = categories[0]!
    return {
      mode: 'category',
      rss: `${origin}/feeds/${id}.xml`,
      ics: withFeedRev(`${origin}/feeds/${id}.ics`, feedRev),
    }
  }

  if (allCategories && groups.length === 1) {
    const id = groups[0]!
    return {
      mode: 'group',
      rss: `${origin}/feeds/group-${id}.xml`,
      ics: withFeedRev(`${origin}/feeds/group-${id}.ics`, feedRev),
    }
  }

  const rss = new URL('/api/feed', origin)
  rss.searchParams.set('format', 'rss')
  if (!allGroups) rss.searchParams.set('groups', groups.join(','))
  if (!allCategories) rss.searchParams.set('categories', categories.join(','))

  const ics = new URL('/api/feed', origin)
  ics.searchParams.set('format', 'ics')
  if (!allGroups) ics.searchParams.set('groups', groups.join(','))
  if (!allCategories) ics.searchParams.set('categories', categories.join(','))
  if (feedRev) ics.searchParams.set('v', feedRev)

  return { mode: 'api', rss: rss.toString(), ics: ics.toString() }
}

export function filterNewsItems(
  items: NewsItemLike[],
  groups: string[],
  categories: string[],
  groupCount: number,
  categoryCount: number,
): NewsItemLike[] {
  const allGroups = groups.length === 0 || groups.length === groupCount
  const allCategories = categories.length === 0 || categories.length === categoryCount
  const groupSet = new Set(groups)
  const catSet = new Set(categories)

  return items.filter((item) => {
    const groupOk = allGroups || (item.groups ?? []).some((g) => groupSet.has(g))
    const catOk = allCategories || (item.categories ?? []).some((c) => catSet.has(c))
    return groupOk && catOk
  })
}

export function buildDayMeta(
  day: Date,
  inMonth: boolean,
  holidays: ReadonlyMap<string, string> = new Map(),
): DayCell {
  const date = toIsoDate(day)
  const holidayName = holidays.get(date)
  return {
    date,
    dayNum: day.getDate(),
    inMonth,
    isRestDay: day.getDay() === 0 || day.getDay() === 6,
    ...(holidayName ? { holidayName } : {}),
  }
}

export function buildMonthCells(
  cursor: Date,
  holidays: ReadonlyMap<string, string> = new Map(),
): DayCell[] {
  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const first = new Date(year, month, 1)
  const startOffset = mondayBasedWeekday(first)
  const start = new Date(year, month, 1 - startOffset)
  const cells: DayCell[] = []
  for (let i = 0; i < 42; i += 1) {
    const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    cells.push(buildDayMeta(day, day.getMonth() === month, holidays))
  }
  return cells
}

export function buildWeekCells(
  cursor: Date,
  holidays: ReadonlyMap<string, string> = new Map(),
): DayCell[] {
  const start = startOfWeek(cursor)
  const cells: DayCell[] = []
  for (let i = 0; i < 7; i += 1) {
    cells.push(buildDayMeta(shiftDay(start, i), true, holidays))
  }
  return cells
}

export function buildCalendarEvents(
  items: NewsItemLike[],
  groups: string[],
  categories: string[],
  groupCount: number,
  categoryCount: number,
): CalendarEvent[] {
  const events: CalendarEvent[] = []
  for (const item of filterNewsItems(items, groups, categories, groupCount, categoryCount)) {
    for (const eventDate of item.eventDates ?? []) {
      if (!eventDate.date) continue
      events.push({
        item,
        date: eventDate.date,
        endDate:
          eventDate.endDate && eventDate.endDate > eventDate.date
            ? eventDate.endDate
            : eventDate.date,
        kind: eventDate.kind,
        ...(eventDate.startTime ? { startTime: eventDate.startTime } : {}),
      })
    }
  }
  return events.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.startTime ?? '').localeCompare(b.startTime ?? '') ||
      a.item.title.localeCompare(b.item.title),
  )
}

export function buildWeekSegments(events: CalendarEvent[], cells: DayCell[]): WeekSegment[] {
  const weekStart = cells[0]!.date
  const weekEnd = cells[cells.length - 1]!.date
  const segments = events
    .filter((event) => event.date <= weekEnd && event.endDate >= weekStart)
    .map((event) => {
      const startDate = event.date < weekStart ? weekStart : event.date
      const endDate = event.endDate > weekEnd ? weekEnd : event.endDate
      return {
        event,
        startColumn: cells.findIndex((cell) => cell.date === startDate),
        endColumn: cells.findIndex((cell) => cell.date === endDate),
        continuesBefore: event.date < weekStart,
        continuesAfter: event.endDate > weekEnd,
        lane: 0,
      }
    })
    .sort(
      (a, b) =>
        a.startColumn - b.startColumn ||
        b.endColumn - a.endColumn ||
        a.event.item.title.localeCompare(b.event.item.title),
    )

  const laneEnds: number[] = []
  for (const segment of segments) {
    let lane = laneEnds.findIndex((endColumn) => endColumn < segment.startColumn)
    if (lane === -1) lane = laneEnds.length
    laneEnds[lane] = segment.endColumn
    segment.lane = lane
  }
  return segments
}

export function chipLabel(segment: {
  event: CalendarEvent
  continuesBefore: boolean
  continuesAfter: boolean
}): string {
  const { event, continuesBefore, continuesAfter } = segment
  const kind = eventKindLabel(event.kind)
  const startMark = continuesBefore ? '… ' : ''
  const endMark = continuesAfter ? ' …' : ''
  const time = event.startTime && !continuesBefore ? `${event.startTime} ` : ''
  return `${kind} ${startMark}${time}${event.item.title}${endMark}`
}
