// src/models/event-date.ts
function defaultDurationMinutes(kind) {
  return kind === 'sale' ? 60 : 120
}

// src/web/subscribe-core.ts
function displayNewsTitle(item) {
  return item.titleZh ?? item.title
}
var MIN_TIMED_BLOCK_MINUTES = 30
var DAY_MINUTES = 1440
var EARLY_HOURS = 8
var WEEKDAY_LABELS = ['\u65E5', '\u4E00', '\u4E8C', '\u4E09', '\u56DB', '\u4E94', '\u516D']
function toIsoDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}
function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}
function mondayBasedWeekday(date) {
  return (date.getDay() + 6) % 7
}
function startOfWeek(date) {
  const day = startOfDay(date)
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() - mondayBasedWeekday(day))
}
function shiftDay(date, delta) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + delta)
}
function shiftMonth(date, delta) {
  const next = new Date(date.getFullYear(), date.getMonth() + delta, 1)
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()
  return new Date(next.getFullYear(), next.getMonth(), Math.min(date.getDate(), lastDay))
}
function formatMonthLabel(date) {
  return `${date.getFullYear()}\u5E74${date.getMonth() + 1}\u6708`
}
function formatWeekLabel(date) {
  const start = startOfWeek(date)
  const end = shiftDay(start, 6)
  const sameMonth = start.getMonth() === end.getMonth()
  if (sameMonth) {
    return `${start.getFullYear()}\u5E74${start.getMonth() + 1}\u6708${start.getDate()}\u65E5\u2013${end.getDate()}\u65E5`
  }
  return `${start.getMonth() + 1}\u6708${start.getDate()}\u65E5\u2013${end.getMonth() + 1}\u6708${end.getDate()}\u65E5`
}
function formatDayLabel(date) {
  return `${date.getFullYear()}\u5E74${date.getMonth() + 1}\u6708${date.getDate()}\u65E5\uFF08\u5468${WEEKDAY_LABELS[date.getDay()]}\uFF09`
}
function eventKindLabel(kind) {
  return kind === 'sale' ? '\u767A\u58F2' : '\u958B\u50AC'
}
function labelList(ids, catalog) {
  if (ids.length === 0 || ids.length === catalog.length) return '\u5168\u90E8'
  const map = Object.fromEntries(catalog.map((item) => [item.id, item.label]))
  return ids.map((id) => map[id] ?? id).join('\u3001')
}
function toWebcal(url) {
  return url.replace(/^https:/, 'webcal:').replace(/^http:/, 'webcal:')
}
function withFeedRev(url, feedRev) {
  if (!feedRev) return url
  const parsed = new URL(url)
  parsed.searchParams.set('v', feedRev)
  return parsed.toString()
}
function buildFeedUrls(options) {
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
    const id = categories[0]
    return {
      mode: 'category',
      rss: `${origin}/feeds/${id}.xml`,
      ics: withFeedRev(`${origin}/feeds/${id}.ics`, feedRev),
    }
  }
  if (allCategories && groups.length === 1) {
    const id = groups[0]
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
function filterNewsItems(items, groups, categories, groupCount, categoryCount) {
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
function buildDayMeta(day, inMonth, holidays = /* @__PURE__ */ new Map()) {
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
function buildMonthCells(cursor, holidays = /* @__PURE__ */ new Map()) {
  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const first = new Date(year, month, 1)
  const startOffset = mondayBasedWeekday(first)
  const start = new Date(year, month, 1 - startOffset)
  const cells = []
  for (let i = 0; i < 42; i += 1) {
    const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    cells.push(buildDayMeta(day, day.getMonth() === month, holidays))
  }
  return cells
}
function buildWeekCells(cursor, holidays = /* @__PURE__ */ new Map()) {
  const start = startOfWeek(cursor)
  const cells = []
  for (let i = 0; i < 7; i += 1) {
    cells.push(buildDayMeta(shiftDay(start, i), true, holidays))
  }
  return cells
}
function buildCalendarEvents(items, groups, categories, groupCount, categoryCount) {
  const events = []
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
function isAllDayEvent(event) {
  return !event.startTime
}
function parseHhmm(time) {
  if (time === '24:00') return DAY_MINUTES
  const [hh, mm] = time.split(':').map(Number)
  return hh * 60 + mm
}
function formatHhmm(totalMinutes) {
  if (totalMinutes >= DAY_MINUTES) return '24:00'
  const wrapped = ((totalMinutes % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES
  const hh = Math.floor(wrapped / 60)
  const mm = wrapped % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}
function addCalendarDays(date, days) {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  const month = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const day = String(dt.getUTCDate()).padStart(2, '0')
  return `${dt.getUTCFullYear()}-${month}-${day}`
}
function resolveEventWallRange(event) {
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
  if (startTime === '23:59') {
    return { startDate, startTime: '23:00', endDate: startDate, endTime: '23:59' }
  }
  const duration = defaultDurationMinutes(event.kind)
  const endTotal = parseHhmm(startTime) + duration
  if (endTotal >= DAY_MINUTES) {
    return { startDate, startTime, endDate: startDate, endTime: '24:00' }
  }
  return { startDate, startTime, endDate: startDate, endTime: formatHhmm(endTotal) }
}
function formatTimeRangeLabel(startTime, endTime) {
  return `${startTime}\u2013${endTime}`
}
function buildDayTimedBlocks(events, isoDate) {
  const blocks = []
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
function layoutTimedLanes(blocks) {
  const laneEnds = []
  for (const block of blocks) {
    let lane = laneEnds.findIndex((endMin) => endMin <= block.startMin)
    if (lane === -1) lane = laneEnds.length
    laneEnds[lane] = block.endMin
    block.lane = lane
  }
  return blocks
}
function timedBlockStyle(block, laneCount) {
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
function earlyHoursFrameVars(expanded, earlyHours = EARLY_HOURS) {
  return {
    earlyHours: String(earlyHours),
    earlyOffset: String(expanded ? 0 : earlyHours),
    visibleHours: String(expanded ? 24 : 24 - earlyHours),
  }
}
function timedBlockStyleWithEarlyToggle(block, laneCount, earlyHours = EARLY_HOURS) {
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
function buildWeekSegments(events, cells) {
  const weekStart = cells[0].date
  const weekEnd = cells[cells.length - 1].date
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
  const laneEnds = []
  for (const segment of segments) {
    let lane = laneEnds.findIndex((endColumn) => endColumn < segment.startColumn)
    if (lane === -1) lane = laneEnds.length
    laneEnds[lane] = segment.endColumn
    segment.lane = lane
  }
  return segments
}
function chipLabel(segment) {
  const { event, continuesBefore, continuesAfter } = segment
  const kind = eventKindLabel(event.kind)
  const startMark = continuesBefore ? '\u2026 ' : ''
  const endMark = continuesAfter ? ' \u2026' : ''
  const time = event.startTime && !continuesBefore ? `${event.startTime} ` : ''
  return `${kind} ${startMark}${time}${displayNewsTitle(event.item)}${endMark}`
}
var THEME_STORAGE_KEY = 'gbc-news-theme'
var THEMES = ['dark', 'light']
function isThemeName(value) {
  return value === 'dark' || value === 'light'
}
function resolveTheme(stored, prefersLight) {
  if (isThemeName(stored)) return stored
  return prefersLight ? 'light' : 'dark'
}
export {
  DAY_MINUTES,
  EARLY_HOURS,
  MIN_TIMED_BLOCK_MINUTES,
  THEMES,
  THEME_STORAGE_KEY,
  WEEKDAY_LABELS,
  buildCalendarEvents,
  buildDayMeta,
  buildDayTimedBlocks,
  buildFeedUrls,
  buildMonthCells,
  buildWeekCells,
  buildWeekSegments,
  chipLabel,
  displayNewsTitle,
  earlyHoursFrameVars,
  eventKindLabel,
  filterNewsItems,
  formatDayLabel,
  formatMonthLabel,
  formatTimeRangeLabel,
  formatWeekLabel,
  isAllDayEvent,
  isThemeName,
  labelList,
  layoutTimedLanes,
  mondayBasedWeekday,
  resolveEventWallRange,
  resolveTheme,
  shiftDay,
  shiftMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
  timedBlockStyle,
  timedBlockStyleWithEarlyToggle,
  toIsoDate,
  toWebcal,
  withFeedRev,
}
