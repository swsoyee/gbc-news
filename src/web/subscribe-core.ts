import { defaultDurationMinutes } from '../models/event-date.js'

export type CalendarView = 'month' | 'week' | 'day'

export interface CatalogItem {
  id: string
  label: string
}

export interface NewsItemLike {
  title: string
  titleZh?: string
  url: string
  groups?: string[]
  categories?: string[]
  eventDates?: {
    date: string
    endDate?: string
    kind: 'hold' | 'sale'
    startTime?: string
    endTime?: string
  }[]
}

export function displayNewsTitle(item: Pick<NewsItemLike, 'title' | 'titleZh'>): string {
  return item.titleZh ?? item.title
}

export interface CalendarEvent {
  item: NewsItemLike
  date: string
  endDate: string
  kind: 'hold' | 'sale'
  startTime?: string
  endTime?: string
}

export interface EventWallRange {
  startDate: string
  startTime: string
  endDate: string
  endTime: string
}

/** 某日时间轴上的可视片段（分钟 0–1440） */
export interface TimedBlock {
  event: CalendarEvent
  startMin: number
  endMin: number
  continuesBefore: boolean
  continuesAfter: boolean
  lane: number
}

/** 渲染时最短色块高度（分钟） */
export const MIN_TIMED_BLOCK_MINUTES = 30
export const DAY_MINUTES = 1440
/** 周/日视图默认折叠的凌晨小时数（0:00–7:59） */
export const EARLY_HOURS = 8

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
      let endDate =
        eventDate.endDate && eventDate.endDate > eventDate.date ? eventDate.endDate : eventDate.date
      if (
        eventDate.startTime &&
        eventDate.endTime &&
        endDate === eventDate.date &&
        eventDate.endTime <= eventDate.startTime
      ) {
        endDate = addCalendarDays(eventDate.date, 1)
      }
      events.push({
        item,
        date: eventDate.date,
        endDate,
        kind: eventDate.kind,
        ...(eventDate.startTime ? { startTime: eventDate.startTime } : {}),
        ...(eventDate.endTime ? { endTime: eventDate.endTime } : {}),
      })
    }
  }
  return events.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.startTime ?? '').localeCompare(b.startTime ?? '') ||
      displayNewsTitle(a.item).localeCompare(displayNewsTitle(b.item)),
  )
}

export function isAllDayEvent(event: CalendarEvent): boolean {
  return !event.startTime
}

function parseHhmm(time: string): number {
  if (time === '24:00') return DAY_MINUTES
  const [hh, mm] = time.split(':').map(Number) as [number, number]
  return hh * 60 + mm
}

function formatHhmm(totalMinutes: number): string {
  if (totalMinutes >= DAY_MINUTES) return '24:00'
  const wrapped = ((totalMinutes % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES
  const hh = Math.floor(wrapped / 60)
  const mm = wrapped % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

function addCalendarDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  const month = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const day = String(dt.getUTCDate()).padStart(2, '0')
  return `${dt.getUTCFullYear()}-${month}-${day}`
}

/** 有 startTime 时解析墙钟起止（缺 endTime 时补默认时长）。 */
export function resolveEventWallRange(event: CalendarEvent): EventWallRange | null {
  if (!event.startTime) return null

  const startDate = event.date
  const startTime = event.startTime
  const spanEndDate = event.endDate

  if (event.endTime) {
    let endDate = spanEndDate
    if (spanEndDate === startDate && event.endTime <= startTime) {
      endDate = addCalendarDays(startDate, 1)
    }
    return { startDate, startTime, endDate, endTime: event.endTime }
  }

  if (spanEndDate > startDate) {
    return { startDate, startTime, endDate: spanEndDate, endTime: '23:59' }
  }

  // 截止时刻 23:59（无 endTime）：日历显示当日 23:00–23:59，避免补默认时长或贴到 24:00
  if (startTime === '23:59') {
    return { startDate, startTime: '23:00', endDate: startDate, endTime: '23:59' }
  }

  const duration = defaultDurationMinutes(event.kind)
  const endTotal = parseHhmm(startTime) + duration
  // 缺省补时长若跨午夜：只画到当日 24:00，避免被拆成两天色块
  if (endTotal >= DAY_MINUTES) {
    return { startDate, startTime, endDate: startDate, endTime: '24:00' }
  }
  return { startDate, startTime, endDate: startDate, endTime: formatHhmm(endTotal) }
}

export function formatTimeRangeLabel(startTime: string, endTime: string): string {
  return `${startTime}–${endTime}`
}

/** 将有时刻事件裁剪到某一天的时间轴片段。 */
export function buildDayTimedBlocks(events: CalendarEvent[], isoDate: string): TimedBlock[] {
  const blocks: TimedBlock[] = []
  for (const event of events) {
    const range = resolveEventWallRange(event)
    if (!range) continue
    if (isoDate < range.startDate || isoDate > range.endDate) continue

    let startMin = 0
    let endMin = DAY_MINUTES
    let continuesBefore = false
    let continuesAfter = false

    if (isoDate === range.startDate) {
      startMin = parseHhmm(range.startTime)
    } else {
      continuesBefore = true
    }

    if (isoDate === range.endDate) {
      endMin = parseHhmm(range.endTime)
      // 结束恰为 00:00 表示落在当日起点，无可视时长
      if (endMin === 0 && isoDate === range.endDate && range.endDate > range.startDate) {
        continue
      }
    } else {
      continuesAfter = true
    }

    if (endMin <= startMin) continue

    blocks.push({
      event,
      startMin,
      endMin,
      continuesBefore,
      continuesAfter,
      lane: 0,
    })
  }

  return blocks.sort(
    (a, b) =>
      a.startMin - b.startMin ||
      b.endMin - a.endMin ||
      displayNewsTitle(a.event.item).localeCompare(displayNewsTitle(b.event.item)),
  )
}

/** 重叠时段分 lane，供列内并排。 */
export function layoutTimedLanes(blocks: TimedBlock[]): TimedBlock[] {
  const laneEnds: number[] = []
  for (const block of blocks) {
    let lane = laneEnds.findIndex((endMin) => endMin <= block.startMin)
    if (lane === -1) lane = laneEnds.length
    laneEnds[lane] = block.endMin
    block.lane = lane
  }
  return blocks
}

export function timedBlockStyle(
  block: TimedBlock,
  laneCount: number,
): {
  top: string
  height: string
  left: string
  width: string
} {
  const span = Math.max(block.endMin - block.startMin, MIN_TIMED_BLOCK_MINUTES)
  const top = (block.startMin / DAY_MINUTES) * 100
  const height = (span / DAY_MINUTES) * 100
  const lanes = Math.max(laneCount, 1)
  const width = 100 / lanes
  const left = (block.lane / lanes) * 100
  return {
    top: `${top}%`,
    height: `${height}%`,
    left: `calc(${left}% + 1px)`,
    width: `calc(${width}% - 2px)`,
  }
}

/** 周/日时间轴折叠态的 CSS 变量（与 --early-hours / --toggle-row-height 对齐）。 */
export function earlyHoursFrameVars(
  expanded: boolean,
  earlyHours: number = EARLY_HOURS,
): { earlyHours: string; earlyOffset: string; visibleHours: string } {
  return {
    earlyHours: String(earlyHours),
    earlyOffset: String(expanded ? 0 : earlyHours),
    visibleHours: String(expanded ? 24 : 24 - earlyHours),
  }
}

/**
 * 带凌晨折叠 toggle 行的色块定位。
 * top/height 按小时行高度计算；跨越 earlyHours 边界时补偿 --toggle-row-height。
 */
export function timedBlockStyleWithEarlyToggle(
  block: TimedBlock,
  laneCount: number,
  earlyHours: number = EARLY_HOURS,
): {
  top: string
  height: string
  left: string
  width: string
} {
  const { left, width } = timedBlockStyle(block, laneCount)
  const span = Math.max(block.endMin - block.startMin, MIN_TIMED_BLOCK_MINUTES)
  const boundaryMin = earlyHours * 60
  const topExtra = block.startMin >= boundaryMin ? 'var(--toggle-row-height)' : '0px'
  const heightExtra =
    block.startMin < boundaryMin && block.startMin + span > boundaryMin
      ? 'var(--toggle-row-height)'
      : '0px'
  return {
    top: `calc(${block.startMin} / ${DAY_MINUTES} * 24 * var(--hour-row-height) + ${topExtra})`,
    height: `calc(${span} / ${DAY_MINUTES} * 24 * var(--hour-row-height) + ${heightExtra})`,
    left,
    width,
  }
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
        displayNewsTitle(a.event.item).localeCompare(displayNewsTitle(b.event.item)),
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
  const startMark = continuesBefore ? '… ' : ''
  const endMark = continuesAfter ? ' …' : ''
  const time = event.startTime && !continuesBefore ? `${event.startTime} ` : ''
  return `${startMark}${time}${displayNewsTitle(event.item)}${endMark}`
}

/** 日历悬浮层：加粗日期行（含可选时间）+ 换行标题；不含開催/発売。 */
export function formatCalendarEventTooltip(event: CalendarEvent): {
  dateLine: string
  title: string
  ariaLabel: string
} {
  const title = displayNewsTitle(event.item)
  const datePart =
    event.endDate && event.endDate !== event.date ? `${event.date} – ${event.endDate}` : event.date
  let dateLine = datePart
  if (event.startTime) {
    const timePart = event.endTime ? `${event.startTime}–${event.endTime}` : event.startTime
    dateLine = `${datePart} ${timePart}`
  }
  return {
    dateLine,
    title,
    ariaLabel: `${dateLine}. ${title}`,
  }
}

export const THEME_STORAGE_KEY = 'gbc-news-theme'

export const THEMES = ['dark', 'light'] as const

export type ThemeName = (typeof THEMES)[number]

export function isThemeName(value: string | null): value is ThemeName {
  return value === 'dark' || value === 'light'
}

/** 解析有效主题：优先 localStorage，否则跟随系统浅色偏好 */
export function resolveTheme(stored: string | null, prefersLight: boolean): ThemeName {
  if (isThemeName(stored)) return stored
  return prefersLight ? 'light' : 'dark'
}
