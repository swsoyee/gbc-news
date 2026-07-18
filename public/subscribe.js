import {
  buildCalendarEvents as buildCalendarEventsCore,
  buildDayTimedBlocks,
  buildFeedUrls as buildFeedUrlsCore,
  buildMonthCells as buildMonthCellsCore,
  buildWeekCells as buildWeekCellsCore,
  buildWeekSegments,
  chipLabel,
  EARLY_HOURS,
  earlyHoursFrameVars,
  displayNewsTitle,
  formatCalendarEventTooltip,
  formatDayLabel,
  formatMonthLabel,
  formatTimeRangeLabel,
  formatWeekLabel,
  isAllDayEvent,
  labelList,
  layoutTimedLanes,
  resolveEventWallRange,
  shiftDay,
  shiftMonth,
  startOfDay,
  startOfMonth,
  timedBlockStyleWithEarlyToggle,
  toIsoDate,
  toWebcal,
  withFeedRev,
  isThemeName,
  resolveTheme,
  THEME_STORAGE_KEY,
} from './subscribe-core.js'

const GROUPS = [
  { id: 'togenashi', label: 'トゲナシトゲアリ' },
  { id: 'f272', label: 'F-272' },
  { id: 'canna-lily', label: 'Canna Lily' },
  { id: 'other', label: '其他/共通' },
]

const CATEGORIES = [
  { id: 'live', label: 'Live' },
  { id: 'event', label: '活动' },
  { id: 'goods', label: '周边' },
  { id: 'music', label: '曲目' },
  { id: 'cinema', label: '剧场/映像' },
  { id: 'media', label: '媒体' },
  { id: 'other', label: '其他' },
]

const HOLIDAY_API_URL = 'https://holidays-jp.github.io/api/v1/date.json'

const groupsEl = document.getElementById('groups')
const catsEl = document.getElementById('cats')
const catLinksEl = document.getElementById('cat-links')
const groupLinksEl = document.getElementById('group-links')
const filterStatusEl = document.getElementById('filter-status')
const rssUrlEl = document.getElementById('rss-url')
const icsUrlEl = document.getElementById('ics-url')
const rssOpen = document.getElementById('rss-open')
const icsOpen = document.getElementById('ics-open')
const toggleGroupsBtn = document.getElementById('toggle-groups')
const toggleCatsBtn = document.getElementById('toggle-cats')
const calendarBoardEl = document.getElementById('calendar-board')
const calendarGridEl = document.getElementById('calendar-grid')
const calendarNoteEl = document.getElementById('calendar-note')
const calendarMonthLabelEl = document.getElementById('calendar-month-label')
const calendarMonthBgEl = document.getElementById('calendar-month-bg')
const calendarPrevBtn = document.getElementById('calendar-prev')
const calendarNextBtn = document.getElementById('calendar-next')
const calendarTodayBtn = document.getElementById('calendar-today')
const calendarViewBtns = document.querySelectorAll('[data-calendar-view]')
const themeToggleBtn = document.getElementById('theme-toggle')

const CHIPS_PER_DAY = 3

/** @type {'month' | 'week' | 'day'} */
let calendarView = 'month'

/** 周/日视图是否展开 0:00–7:59 */
let earlyHoursExpanded = false

/** 当前看板日期：本地时区的某一天 */
let calendarCursor = startOfDay(new Date())

/** @type {{ title: string, titleZh?: string, url: string, groups?: string[], categories?: string[], eventDates?: { date: string, endDate?: string, kind: 'hold' | 'sale', startTime?: string, endTime?: string }[] }[]} */
let newsItems = []

/** 来自 news.json scrapedAt，用于 ICS URL ?v= */
let feedRev = ''

/** @type {Map<string, string>} 日本公共节假日：ISO 日期 → 名称 */
let holidayNames = new Map()

function prefersLightScheme() {
  return window.matchMedia('(prefers-color-scheme: light)').matches
}

function hasStoredTheme() {
  try {
    return isThemeName(localStorage.getItem(THEME_STORAGE_KEY))
  } catch {
    return false
  }
}

function readStoredTheme() {
  try {
    return resolveTheme(localStorage.getItem(THEME_STORAGE_KEY), prefersLightScheme())
  } catch {
    return resolveTheme(null, prefersLightScheme())
  }
}

function getCurrentTheme() {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
}

function themeColorFromCss() {
  return getComputedStyle(document.documentElement).getPropertyValue('--bg0').trim()
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme === 'light' ? 'light' : 'dark'
  const themeColor = themeColorFromCss()
  if (themeColor) {
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor)
  }
  if (themeToggleBtn instanceof HTMLButtonElement) {
    const nextAction = theme === 'light' ? '关灯' : '开灯'
    themeToggleBtn.title = nextAction
    themeToggleBtn.setAttribute('aria-label', nextAction)
    themeToggleBtn.setAttribute('aria-pressed', theme === 'light' ? 'true' : 'false')
  }
}

function setTheme(theme, persist = true) {
  applyTheme(theme)
  if (!persist) return
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Ignore storage errors; the visual toggle should still work for this page.
  }
}

applyTheme(readStoredTheme())

window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', (event) => {
  if (!hasStoredTheme()) setTheme(event.matches ? 'light' : 'dark', false)
})

function mountCheckboxes(container, items, name) {
  container.replaceChildren()
  for (const item of items) {
    const label = document.createElement('label')
    label.className = 'cat'
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.name = name
    input.value = item.id
    input.checked = true
    const span = document.createElement('span')
    span.textContent = item.label
    label.append(input, span)
    container.appendChild(label)
  }
}

mountCheckboxes(groupsEl, GROUPS, 'group')
mountCheckboxes(catsEl, CATEGORIES, 'category')

function selectedValues(container) {
  return [...container.querySelectorAll('input:checked')].map((input) => input.value)
}

function setAllChecked(container, checked) {
  for (const input of container.querySelectorAll('input[type="checkbox"]')) {
    input.checked = checked
  }
}

function areAllChecked(container) {
  const inputs = [...container.querySelectorAll('input[type="checkbox"]')]
  return inputs.length > 0 && inputs.every((input) => input.checked)
}

function toggleAllChecked(container) {
  setAllChecked(container, !areAllChecked(container))
}

function syncToggleButton(container, button) {
  if (!button) return
  button.textContent = '全选'
  button.classList.toggle('is-active', areAllChecked(container))
}

function countFiltered(groups, categories) {
  const allGroups = groups.length === 0 || groups.length === GROUPS.length
  const allCategories = categories.length === 0 || categories.length === CATEGORIES.length
  const groupSet = new Set(groups)
  const catSet = new Set(categories)

  let items = 0
  let dated = 0
  for (const item of newsItems) {
    const groupOk = allGroups || (item.groups ?? []).some((g) => groupSet.has(g))
    const catOk = allCategories || (item.categories ?? []).some((c) => catSet.has(c))
    if (!groupOk || !catOk) continue
    items += 1
    if (item.eventDates?.length) dated += 1
  }
  return { items, dated }
}

function buildFeedUrls(groups, categories) {
  return buildFeedUrlsCore({
    origin: window.location.origin,
    groups,
    categories,
    groupCount: GROUPS.length,
    categoryCount: CATEGORIES.length,
    feedRev,
  })
}

function localTodayIso() {
  return toIsoDate(new Date())
}

function buildMonthCells(cursor) {
  return buildMonthCellsCore(cursor, holidayNames)
}

function buildWeekCells(cursor) {
  return buildWeekCellsCore(cursor, holidayNames)
}

function buildCalendarEvents(groups, categories) {
  return buildCalendarEventsCore(newsItems, groups, categories, GROUPS.length, CATEGORIES.length)
}

let calendarTooltipEl
let calendarTooltipTimer
let calendarTooltipSwitchTimer
let calendarTooltipSticky = false
let calendarTooltipAnchor = null
let calendarTooltipDismissBound = false

function isTouchCalendarUi() {
  return window.matchMedia('(hover: none), (pointer: coarse)').matches
}

function getCalendarTooltip() {
  if (calendarTooltipEl) return calendarTooltipEl
  calendarTooltipEl = document.createElement('div')
  calendarTooltipEl.className = 'calendar-event-tooltip'
  calendarTooltipEl.setAttribute('role', 'tooltip')
  document.body.appendChild(calendarTooltipEl)
  return calendarTooltipEl
}

function ensureCalendarTooltipDismiss() {
  if (calendarTooltipDismissBound) return
  calendarTooltipDismissBound = true
  document.addEventListener(
    'pointerdown',
    (event) => {
      if (!calendarTooltipSticky || !calendarTooltipEl?.classList.contains('is-visible')) return
      const target = event.target
      if (!(target instanceof Node)) return
      if (calendarTooltipEl.contains(target)) return
      if (calendarTooltipAnchor?.contains(target)) return
      hideCalendarTooltip({ force: true })
    },
    true,
  )
}

function positionCalendarTooltipAtPointer(x, y) {
  const tooltip = getCalendarTooltip()
  const pad = 12
  const showBelow = y < 96
  const left = Math.min(window.innerWidth - pad, Math.max(pad, x))
  const top = showBelow ? y + 14 : y - 14
  tooltip.style.left = `${left}px`
  tooltip.style.top = `${top}px`
  tooltip.style.maxHeight = ''
  tooltip.style.overflowY = ''
  tooltip.classList.toggle('is-below', showBelow)
}

function positionCalendarTooltipAtAnchor(anchor) {
  const tooltip = getCalendarTooltip()
  const rect = anchor.getBoundingClientRect()
  const showBelow = rect.top < 80
  const left = Math.min(
    window.innerWidth - 16,
    Math.max(16, rect.left + Math.min(rect.width / 2, 72)),
  )
  tooltip.style.left = `${left}px`
  tooltip.style.top = `${showBelow ? rect.bottom + 8 : rect.top - 8}px`
  tooltip.style.maxHeight = ''
  tooltip.style.overflowY = ''
  tooltip.classList.toggle('is-below', showBelow)
}

/** 移动端 sticky：左上角定位（不用 translate -50%），按实测宽高夹进视口。 */
function positionStickyCalendarTooltip(anchor) {
  const tooltip = getCalendarTooltip()
  const pad = 12
  const maxWidth = window.innerWidth - pad * 2
  tooltip.style.width = ''
  tooltip.style.maxWidth = `${maxWidth}px`
  tooltip.style.maxHeight = ''
  tooltip.style.overflowY = ''

  // 先放到安全区量尺寸（sticky 样式下 left/top 即盒子左上角）
  tooltip.style.left = `${pad}px`
  tooltip.style.top = `${pad}px`
  tooltip.classList.add('is-below')
  const tipWidth = Math.min(Math.max(tooltip.offsetWidth, 1), maxWidth)
  const tipHeight = Math.max(tooltip.offsetHeight, 1)
  const anchorRect = anchor.getBoundingClientRect()

  let left = anchorRect.left + Math.min(anchorRect.width / 2, 48) - tipWidth / 2
  left = Math.min(Math.max(pad, left), window.innerWidth - pad - tipWidth)

  let top = anchorRect.bottom + 8
  let below = true
  if (top + tipHeight > window.innerHeight - pad) {
    top = anchorRect.top - tipHeight - 8
    below = false
  }
  if (top < pad) {
    top = pad
    below = true
  }
  const available = window.innerHeight - pad - top
  if (tipHeight > available) {
    tooltip.style.maxHeight = `${Math.max(120, available)}px`
    tooltip.style.overflowY = 'auto'
  }

  tooltip.style.left = `${left}px`
  tooltip.style.top = `${top}px`
  tooltip.classList.toggle('is-below', below)
}

function fillCalendarTooltip(parts, options = {}) {
  const tooltip = getCalendarTooltip()
  const metaEl = document.createElement('div')
  metaEl.className = 'calendar-event-tooltip-meta'
  const dateEl = document.createElement('div')
  dateEl.className = 'calendar-event-tooltip-date'
  dateEl.textContent = parts.dateLine
  metaEl.appendChild(dateEl)
  if (parts.sourceLabel) {
    const sourceEl = document.createElement('span')
    sourceEl.className = 'calendar-event-tooltip-source'
    if (parts.sourceId) sourceEl.dataset.source = parts.sourceId
    sourceEl.textContent = parts.sourceLabel
    metaEl.appendChild(sourceEl)
  }
  const titleEl = document.createElement('div')
  titleEl.className = 'calendar-event-tooltip-title'
  titleEl.textContent = parts.title
  const nodes = [metaEl, titleEl]
  if (options.showDetailLink) {
    const detailEl = document.createElement('a')
    detailEl.className = 'calendar-event-tooltip-detail'
    detailEl.href = parts.url
    detailEl.target = '_blank'
    detailEl.rel = 'noopener'
    detailEl.textContent = '查看详细'
    nodes.push(detailEl)
  }
  tooltip.replaceChildren(...nodes)
}

function showCalendarTooltip(anchor, parts, options = {}) {
  if (calendarTooltipTimer) window.clearTimeout(calendarTooltipTimer)
  if (calendarTooltipSwitchTimer) window.clearTimeout(calendarTooltipSwitchTimer)
  const sticky = Boolean(options.sticky)
  calendarTooltipSticky = sticky
  calendarTooltipAnchor = anchor
  ensureCalendarTooltipDismiss()

  const tooltip = getCalendarTooltip()
  fillCalendarTooltip(parts, { showDetailLink: sticky || isTouchCalendarUi() })
  tooltip.classList.toggle('is-sticky', sticky)
  if (sticky) {
    positionStickyCalendarTooltip(anchor)
  } else if (typeof options.x === 'number' && typeof options.y === 'number') {
    positionCalendarTooltipAtPointer(options.x, options.y)
  } else {
    positionCalendarTooltipAtAnchor(anchor)
  }
  tooltip.classList.remove('is-visible')
  void tooltip.offsetWidth
  tooltip.classList.add('is-visible')
  if (sticky) {
    // 可见后尺寸可能变化，再夹一次
    positionStickyCalendarTooltip(anchor)
  }
}

function scheduleShowCalendarTooltip(anchor, parts, pointer) {
  if (calendarTooltipTimer) window.clearTimeout(calendarTooltipTimer)
  if (calendarTooltipSwitchTimer) window.clearTimeout(calendarTooltipSwitchTimer)
  const switching = Boolean(
    calendarTooltipAnchor &&
    calendarTooltipAnchor !== anchor &&
    calendarTooltipEl?.classList.contains('is-visible'),
  )
  const delay = switching ? 240 : 0
  const show = () => {
    showCalendarTooltip(anchor, parts, {
      x: pointer.x,
      y: pointer.y,
    })
  }
  if (delay === 0) {
    show()
    return
  }
  calendarTooltipSwitchTimer = window.setTimeout(show, delay)
}

function scheduleHideCalendarTooltip() {
  if (calendarTooltipSwitchTimer) window.clearTimeout(calendarTooltipSwitchTimer)
  if (calendarTooltipTimer) window.clearTimeout(calendarTooltipTimer)
  hideCalendarTooltip()
}

function hideCalendarTooltip(options = {}) {
  if (!calendarTooltipEl) return
  if (calendarTooltipSticky && !options.force) return
  if (calendarTooltipTimer) window.clearTimeout(calendarTooltipTimer)
  if (calendarTooltipSwitchTimer) window.clearTimeout(calendarTooltipSwitchTimer)
  calendarTooltipSticky = false
  calendarTooltipAnchor = null
  // 立刻关掉，避免桌面端离开色块后还悬空跟随造成卡顿感
  calendarTooltipEl.classList.add('is-hide-instant')
  calendarTooltipEl.classList.remove('is-visible', 'is-sticky')
  calendarTooltipEl.replaceChildren()
  calendarTooltipEl.style.maxHeight = ''
  calendarTooltipEl.style.overflowY = ''
  void calendarTooltipEl.offsetWidth
  calendarTooltipEl.classList.remove('is-hide-instant')
}

function syncCalendarViewButtons() {
  for (const button of calendarViewBtns) {
    button.classList.toggle('is-active', button.getAttribute('data-calendar-view') === calendarView)
  }
}

function syncCalendarNav() {
  if (!calendarPrevBtn || !calendarNextBtn || !calendarTodayBtn) return
  if (calendarView === 'week') {
    calendarPrevBtn.textContent = '上周'
    calendarPrevBtn.setAttribute('aria-label', '上周')
    calendarNextBtn.textContent = '下周'
    calendarNextBtn.setAttribute('aria-label', '下周')
    calendarTodayBtn.textContent = '本周'
  } else if (calendarView === 'day') {
    calendarPrevBtn.textContent = '前一天'
    calendarPrevBtn.setAttribute('aria-label', '前一天')
    calendarNextBtn.textContent = '后一天'
    calendarNextBtn.setAttribute('aria-label', '后一天')
    calendarTodayBtn.textContent = '今天'
  } else {
    calendarPrevBtn.textContent = '上个月'
    calendarPrevBtn.setAttribute('aria-label', '上个月')
    calendarNextBtn.textContent = '下个月'
    calendarNextBtn.setAttribute('aria-label', '下个月')
    calendarTodayBtn.textContent = '本月'
  }
}

function bindEventTooltip(el, event) {
  const parts = formatCalendarEventTooltip(event)
  /** @type {{ x: number, y: number }} */
  const pointer = { x: 0, y: 0 }
  el.setAttribute('aria-label', parts.ariaLabel)
  el.addEventListener('mouseenter', (mouseEvent) => {
    if (isTouchCalendarUi()) return
    pointer.x = mouseEvent.clientX
    pointer.y = mouseEvent.clientY
    scheduleShowCalendarTooltip(el, parts, pointer)
  })
  el.addEventListener('mousemove', (mouseEvent) => {
    if (isTouchCalendarUi() || calendarTooltipSticky) return
    pointer.x = mouseEvent.clientX
    pointer.y = mouseEvent.clientY
    if (calendarTooltipAnchor !== el) return
    if (!calendarTooltipEl?.classList.contains('is-visible')) return
    positionCalendarTooltipAtPointer(pointer.x, pointer.y)
  })
  el.addEventListener('mouseleave', () => {
    if (isTouchCalendarUi()) return
    scheduleHideCalendarTooltip()
  })
  el.addEventListener('focus', () => {
    if (isTouchCalendarUi()) return
    const rect = el.getBoundingClientRect()
    pointer.x = rect.left + Math.min(rect.width / 2, 72)
    pointer.y = rect.top + rect.height / 2
    scheduleShowCalendarTooltip(el, parts, pointer)
  })
  el.addEventListener('blur', () => {
    if (isTouchCalendarUi()) return
    scheduleHideCalendarTooltip()
  })
  el.addEventListener('click', (clickEvent) => {
    if (!isTouchCalendarUi()) return
    clickEvent.preventDefault()
    clickEvent.stopPropagation()
    showCalendarTooltip(el, parts, { sticky: true })
  })
}

function appendDayCell(weekEl, cell, dayIndex, today) {
  const cellEl = document.createElement('div')
  cellEl.className = 'calendar-day-cell'
  cellEl.style.gridColumn = String(dayIndex + 1)
  cellEl.style.gridRow = '1'
  if (!cell.inMonth) cellEl.classList.add('is-outside')
  if (cell.isRestDay) cellEl.classList.add('is-rest-day')
  if (cell.holidayName) {
    cellEl.classList.add('is-holiday')
    cellEl.title = `日本公共节假日：${cell.holidayName}`
  }
  if (cell.date === today) cellEl.classList.add('is-today')

  const num = document.createElement('div')
  num.className = 'calendar-day-num'
  num.textContent = String(cell.dayNum)
  cellEl.appendChild(num)
  weekEl.appendChild(cellEl)
}

function renderWeekRow(events, weekCells, today, chipLimit) {
  const weekEl = document.createElement('div')
  weekEl.className = 'calendar-week'

  for (const [dayIndex, cell] of weekCells.entries()) {
    appendDayCell(weekEl, cell, dayIndex, today)
  }

  const segments = buildWeekSegments(events, weekCells)
  for (const segment of segments) {
    const { event } = segment
    const chip = document.createElement('a')
    chip.className = event.kind === 'sale' ? 'calendar-chip is-sale' : 'calendar-chip'
    if (event.endDate > event.date) chip.classList.add('is-span')
    if (segment.lane >= chipLimit) chip.classList.add('is-overflow')
    chip.style.gridColumn = `${segment.startColumn + 1} / ${segment.endColumn + 2}`
    chip.style.setProperty('--calendar-lane', String(segment.lane))
    chip.href = event.item.url
    chip.target = '_blank'
    chip.rel = 'noopener'
    bindEventTooltip(chip, event)
    chip.textContent = chipLabel(segment)
    weekEl.appendChild(chip)
  }

  let hasOverflow = false
  for (let dayIndex = 0; dayIndex < weekCells.length; dayIndex += 1) {
    const hiddenCount = segments.filter(
      (segment) =>
        segment.lane >= chipLimit &&
        segment.startColumn <= dayIndex &&
        dayIndex <= segment.endColumn,
    ).length
    if (hiddenCount > 0) {
      hasOverflow = true
      const more = document.createElement('div')
      more.className = 'calendar-more'
      more.style.gridColumn = String(dayIndex + 1)
      more.style.marginTop = `calc(2.15rem + ${chipLimit} * 1.25rem)`
      more.textContent = `+${hiddenCount}`
      more.title = '悬浮显示全部事件'
      more.addEventListener('mouseenter', () => weekEl.classList.add('is-expanded'))
      weekEl.appendChild(more)
    }
  }
  if (hasOverflow) {
    weekEl.addEventListener('mouseleave', () => weekEl.classList.remove('is-expanded'))
  }

  return { weekEl, hasOverflow }
}

function appendTimedBlocks(layerEl, events, isoDate) {
  const blocks = layoutTimedLanes(buildDayTimedBlocks(events, isoDate))
  const laneCount = blocks.reduce((max, block) => Math.max(max, block.lane + 1), 0)
  for (const block of blocks) {
    const style = timedBlockStyleWithEarlyToggle(block, laneCount)
    const el = document.createElement('a')
    el.className =
      block.event.kind === 'sale' ? 'calendar-timed-block is-sale' : 'calendar-timed-block'
    el.href = block.event.item.url
    el.target = '_blank'
    el.rel = 'noopener'
    el.style.top = style.top
    el.style.height = style.height
    el.style.left = style.left
    el.style.width = style.width

    const range = resolveEventWallRange(block.event)
    const timeText = range
      ? formatTimeRangeLabel(
          block.continuesBefore ? '00:00' : range.startTime,
          block.continuesAfter ? '24:00' : range.endTime,
        )
      : ''
    const timeEl = document.createElement('div')
    timeEl.className = 'calendar-timed-time'
    timeEl.textContent = timeText
    const titleEl = document.createElement('div')
    titleEl.className = 'calendar-timed-title'
    titleEl.textContent = displayNewsTitle(block.event.item)
    el.append(timeEl, titleEl)

    bindEventTooltip(el, block.event)
    layerEl.appendChild(el)
  }
  return blocks.length
}

function buildHourRail() {
  const rail = document.createElement('div')
  rail.className = 'calendar-hour-rail'
  for (let hour = 0; hour < 24; hour += 1) {
    if (hour === EARLY_HOURS) {
      const toggleRow = document.createElement('div')
      toggleRow.className = 'calendar-early-toggle-row'
      toggleRow.appendChild(buildEarlyHoursToggle())
      rail.appendChild(toggleRow)
    }
    const mark = document.createElement('div')
    mark.className = 'calendar-hour-mark'
    const label = document.createElement('span')
    label.className = 'calendar-hour-label'
    label.textContent = `${hour}:00`
    mark.appendChild(label)
    rail.appendChild(mark)
  }
  return rail
}

function buildEarlyHoursToggle() {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'calendar-early-toggle'
  button.setAttribute('aria-label', earlyHoursExpanded ? '收起凌晨时段' : '展开凌晨时段')
  button.setAttribute('aria-expanded', earlyHoursExpanded ? 'true' : 'false')
  button.title = earlyHoursExpanded ? '收起 0:00–7:59' : '展开 0:00–7:59'
  button.textContent = earlyHoursExpanded ? '−' : '+'
  button.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    setEarlyHoursExpanded(!earlyHoursExpanded)
  })
  return button
}

function applyEarlyHoursFrameVars(frame, expanded) {
  const vars = earlyHoursFrameVars(expanded, EARLY_HOURS)
  frame.style.setProperty('--early-hours', vars.earlyHours)
  frame.style.setProperty('--early-offset', vars.earlyOffset)
  frame.style.setProperty('--visible-hours', vars.visibleHours)
}

function setEarlyHoursExpanded(expanded) {
  earlyHoursExpanded = expanded
  const frame = calendarGridEl?.querySelector('.calendar-time-frame')
  if (!frame) {
    refreshCalendarOnly()
    return
  }
  applyEarlyHoursFrameVars(frame, expanded)
  const button = frame.querySelector('.calendar-early-toggle')
  if (button instanceof HTMLButtonElement) {
    button.textContent = expanded ? '−' : '+'
    button.setAttribute('aria-expanded', expanded ? 'true' : 'false')
    button.setAttribute('aria-label', expanded ? '收起凌晨时段' : '展开凌晨时段')
    button.title = expanded ? '收起 0:00–7:59' : '展开 0:00–7:59'
  }
}

function applyDayState(el, cell, today) {
  if (cell.isRestDay) el.classList.add('is-rest-day')
  if (cell.holidayName) {
    el.classList.add('is-holiday')
    el.title = `日本公共节假日：${cell.holidayName}`
  }
  if (cell.date === today) el.classList.add('is-today')
}

/** 统一 gutter + N 列；全天 chip 仅在表头子网格内悬浮，避免挤占主列 */
function renderTimeGridFrame(events, cells, today) {
  const colCount = cells.length
  const root = document.createElement('div')
  root.className = colCount === 1 ? 'calendar-time-grid is-day' : 'calendar-time-grid is-week'
  root.style.setProperty('--cal-cols', String(colCount))

  const frame = document.createElement('div')
  frame.className = 'calendar-time-frame'

  const header = document.createElement('div')
  header.className = 'calendar-time-header'

  const corner = document.createElement('div')
  corner.className = 'calendar-time-corner'
  header.appendChild(corner)

  for (const [index, cell] of cells.entries()) {
    const head = document.createElement('div')
    head.className = 'calendar-day-head'
    head.style.gridColumn = String(index + 2)
    if (index === cells.length - 1) head.classList.add('is-last-col')
    applyDayState(head, cell, today)
    const num = document.createElement('div')
    num.className = 'calendar-day-num'
    num.textContent = String(cell.dayNum)
    head.appendChild(num)
    header.appendChild(head)
  }

  const allDayEvents = events.filter(isAllDayEvent)
  const segments = buildWeekSegments(allDayEvents, cells)
  for (const segment of segments) {
    if (segment.startColumn < 0 || segment.endColumn < 0) continue
    const chip = document.createElement('a')
    chip.className =
      segment.event.kind === 'sale' ? 'calendar-chip is-sale is-allday' : 'calendar-chip is-allday'
    if (segment.event.endDate > segment.event.date) chip.classList.add('is-span')
    // header 第 1 列为 gutter，日期列从 2 起
    chip.style.gridColumn = `${segment.startColumn + 2} / ${segment.endColumn + 3}`
    chip.style.setProperty('--calendar-lane', String(segment.lane))
    chip.href = segment.event.item.url
    chip.target = '_blank'
    chip.rel = 'noopener'
    bindEventTooltip(chip, segment.event)
    chip.textContent = chipLabel(segment)
    header.appendChild(chip)
  }
  const laneCount = segments.reduce((max, segment) => Math.max(max, segment.lane + 1), 0)
  header.style.setProperty('--allday-lanes', String(Math.max(laneCount, 1)))
  frame.appendChild(header)

  applyEarlyHoursFrameVars(frame, earlyHoursExpanded)

  const viewport = document.createElement('div')
  viewport.className = 'calendar-timed-viewport'

  const shift = document.createElement('div')
  shift.className = 'calendar-timed-shift'

  shift.appendChild(buildHourRail())

  const columns = document.createElement('div')
  columns.className = 'calendar-timed-columns'
  let timedCount = 0
  for (const cell of cells) {
    const col = document.createElement('div')
    col.className = 'calendar-time-col'
    applyDayState(col, cell, today)
    const layer = document.createElement('div')
    layer.className = 'calendar-timed-layer'
    timedCount += appendTimedBlocks(layer, events, cell.date)
    col.appendChild(layer)
    columns.appendChild(col)
  }
  shift.appendChild(columns)
  viewport.appendChild(shift)
  frame.appendChild(viewport)

  root.appendChild(frame)
  return { root, timedCount, allDayCount: allDayEvents.length }
}

function renderWeekTimeGrid(events, weekCells, today) {
  return renderTimeGridFrame(events, weekCells, today).root
}

function renderDayTimeGrid(events, isoDate, today) {
  const cursorDate = new Date(
    Number(isoDate.slice(0, 4)),
    Number(isoDate.slice(5, 7)) - 1,
    Number(isoDate.slice(8, 10)),
  )
  const dayCell = {
    date: isoDate,
    dayNum: cursorDate.getDate(),
    inMonth: true,
    isRestDay: cursorDate.getDay() === 0 || cursorDate.getDay() === 6,
    holidayName: holidayNames.get(isoDate),
  }
  return renderTimeGridFrame(events, [dayCell], today).root
}

/** 避免筛选/重绘时清空大块 DOM 导致页面高度塌缩、滚动被浏览器夹到顶部。 */
function withPreservedScroll(run) {
  const scrollX = window.scrollX
  const scrollY = window.scrollY
  run()
  window.scrollTo(scrollX, scrollY)
}

function renderCalendar(groups, categories) {
  if (!calendarGridEl) return

  hideCalendarTooltip({ force: true })
  const events = buildCalendarEvents(groups, categories)
  const today = localTodayIso()
  syncCalendarViewButtons()
  syncCalendarNav()

  if (calendarBoardEl) {
    calendarBoardEl.classList.toggle('is-week-view', calendarView === 'week')
    calendarBoardEl.classList.toggle('is-day-view', calendarView === 'day')
    calendarBoardEl.dataset.view = calendarView
  }

  if (calendarView === 'day') {
    const isoDate = toIsoDate(calendarCursor)
    if (calendarMonthLabelEl) calendarMonthLabelEl.textContent = formatDayLabel(calendarCursor)
    if (calendarMonthBgEl) calendarMonthBgEl.textContent = String(calendarCursor.getDate())
    if (calendarNoteEl) {
      const count = events.filter(
        (event) => event.date <= isoDate && isoDate <= event.endDate,
      ).length
      calendarNoteEl.textContent = count > 0 ? `当天 ${count} 件（受当前筛选影响）` : ''
    }
    calendarGridEl.replaceChildren(renderDayTimeGrid(events, isoDate, today))
    return
  }

  if (calendarView === 'week') {
    const weekCells = buildWeekCells(calendarCursor)
    const weekStart = weekCells[0].date
    const weekEnd = weekCells[6].date
    if (calendarMonthLabelEl) calendarMonthLabelEl.textContent = formatWeekLabel(calendarCursor)
    if (calendarMonthBgEl) calendarMonthBgEl.textContent = String(calendarCursor.getMonth() + 1)
    if (calendarNoteEl) {
      const count = events.filter(
        (event) => event.date <= weekEnd && event.endDate >= weekStart,
      ).length
      calendarNoteEl.textContent =
        count > 0 ? `本周 ${count} 件（受当前筛选影响）` : '本周当前筛选下没有活动'
    }
    calendarGridEl.replaceChildren(renderWeekTimeGrid(events, weekCells, today))
    return
  }

  const cells = buildMonthCells(calendarCursor)
  const monthStart = toIsoDate(startOfMonth(calendarCursor))
  const monthEnd = toIsoDate(
    new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + 1, 0),
  )
  const monthEventCount = events.filter(
    (event) => event.date <= monthEnd && event.endDate >= monthStart,
  ).length

  if (calendarMonthLabelEl) calendarMonthLabelEl.textContent = formatMonthLabel(calendarCursor)
  if (calendarMonthBgEl) calendarMonthBgEl.textContent = String(calendarCursor.getMonth() + 1)
  if (calendarNoteEl) {
    calendarNoteEl.textContent =
      monthEventCount > 0
        ? `本月 ${monthEventCount} 件（受当前筛选影响）`
        : '本月当前筛选下没有活动'
  }

  const fragment = document.createDocumentFragment()
  const overflowWeeks = []
  for (let weekStart = 0; weekStart < cells.length; weekStart += 7) {
    const { weekEl, hasOverflow } = renderWeekRow(
      events,
      cells.slice(weekStart, weekStart + 7),
      today,
      CHIPS_PER_DAY,
    )
    fragment.appendChild(weekEl)
    if (hasOverflow) overflowWeeks.push(weekEl)
  }
  calendarGridEl.replaceChildren(fragment)
  for (const weekEl of overflowWeeks) {
    weekEl.style.setProperty('--calendar-expanded-height', `${weekEl.scrollHeight}px`)
  }
}

function refreshCalendarOnly() {
  withPreservedScroll(() => {
    const groups = selectedValues(groupsEl)
    const categories = selectedValues(catsEl)
    renderCalendar(groups, categories)
  })
}

function renderStaticLinks(activeGroups, activeCategories) {
  const allGroups = activeGroups.length === 0 || activeGroups.length === GROUPS.length
  const allCategories =
    activeCategories.length === 0 || activeCategories.length === CATEGORIES.length
  const groupSet = new Set(activeGroups)
  const catSet = new Set(activeCategories)

  if (groupLinksEl) {
    const fragment = document.createDocumentFragment()
    for (const group of GROUPS) {
      const active = allGroups || groupSet.has(group.id)
      const ics = withFeedRev(`${location.origin}/feeds/group-${group.id}.ics`, feedRev)
      fragment.appendChild(
        buildLinkRow({
          title: active ? group.label : `${group.label}（当前未选）`,
          ics,
          rssPath: `/feeds/group-${group.id}.xml`,
          dimmed: !active,
        }),
      )
    }
    groupLinksEl.replaceChildren(fragment)
  }

  if (catLinksEl) {
    const fragment = document.createDocumentFragment()
    for (const category of CATEGORIES) {
      const active = allCategories || catSet.has(category.id)
      const ics = withFeedRev(`${location.origin}/feeds/${category.id}.ics`, feedRev)
      fragment.appendChild(
        buildLinkRow({
          title: active ? category.label : `${category.label}（当前未选）`,
          ics,
          rssPath: `/feeds/${category.id}.xml`,
          dimmed: !active,
        }),
      )
    }
    catLinksEl.replaceChildren(fragment)
  }
}

function iconSvg(kind) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('focusable', 'false')
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  path.setAttribute('fill', 'currentColor')
  const paths = {
    rss: 'M6.18 15.64a2.18 2.18 0 1 1 0 4.36 2.18 2.18 0 0 1 0-4.36Zm-2.36-6.9v2.82c3.9 0 7.08 3.18 7.08 7.08h2.82c0-5.46-4.44-9.9-9.9-9.9Zm0-5.64v2.82c7.02 0 12.72 5.7 12.72 12.72h2.82C19.36 9.3 12.06 2 3.82 2Z',
    calendar:
      'M7 2h2v2h6V2h2v2h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3V2Zm13 8H4v10h16V10Zm-9 2h2v2h2v2h-2v2h-2v-2H9v-2h2v-2Z',
    copy: 'M16 1H6a2 2 0 0 0-2 2v12h2V3h10V1Zm3 4H10a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Zm0 16H10V7h9v14Z',
  }
  path.setAttribute('d', paths[kind] ?? paths.copy)
  svg.appendChild(path)
  return svg
}

function buildLinkRow({ title, ics, rssPath, dimmed }) {
  const row = document.createElement('div')
  row.className = dimmed ? 'link-row is-dimmed' : 'link-row'

  const strong = document.createElement('strong')
  strong.textContent = title

  const codeWrap = document.createElement('div')
  codeWrap.className = 'link-code'

  const field = document.createElement('div')
  field.className = 'link-field'

  const code = document.createElement('code')
  code.textContent = ics

  const copyBtn = document.createElement('button')
  copyBtn.type = 'button'
  copyBtn.className = 'btn-icon copy-inline'
  copyBtn.setAttribute('aria-label', '复制链接')
  copyBtn.title = '复制链接'
  copyBtn.dataset.copyText = ics
  copyBtn.appendChild(iconSvg('copy'))

  const actions = document.createElement('div')
  actions.className = 'link-actions'

  const calLink = document.createElement('a')
  calLink.className = 'btn-icon primary'
  calLink.href = toWebcal(ics)
  calLink.setAttribute('aria-label', '订阅日历')
  calLink.title = '订阅日历'
  calLink.appendChild(iconSvg('calendar'))

  const rssLink = document.createElement('a')
  rssLink.className = 'btn-icon'
  rssLink.href = rssPath
  rssLink.target = '_blank'
  rssLink.rel = 'noopener'
  rssLink.setAttribute('aria-label', '打开 RSS')
  rssLink.title = '打开 RSS'
  rssLink.appendChild(iconSvg('rss'))

  field.append(code, copyBtn)
  actions.append(calLink, rssLink)
  codeWrap.append(field, actions)
  row.append(strong, codeWrap)
  return row
}

function refresh() {
  withPreservedScroll(() => {
    const groups = selectedValues(groupsEl)
    const categories = selectedValues(catsEl)
    const { rss, ics, mode } = buildFeedUrls(groups, categories)
    const counts = countFiltered(groups, categories)

    rssUrlEl.textContent = rss
    icsUrlEl.textContent = ics
    rssOpen.href = rss
    icsOpen.href = toWebcal(ics)

    const groupLabel = labelList(groups, GROUPS)
    const catLabel = labelList(categories, CATEGORIES)
    if (filterStatusEl) {
      filterStatusEl.textContent = `当前筛选：组合「${groupLabel}」× 分类「${catLabel}」→ 匹配资讯 ${counts.items} 条（含活动日 ${counts.dated} 条）｜订阅模式 ${mode}`
    }

    renderCalendar(groups, categories)
    renderStaticLinks(groups, categories)
    syncToggleButton(groupsEl, toggleGroupsBtn)
    syncToggleButton(catsEl, toggleCatsBtn)
  })
}

async function copyText(text, button) {
  if (!text) return
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
    } else {
      const area = document.createElement('textarea')
      area.value = text
      area.setAttribute('readonly', '')
      area.style.position = 'fixed'
      area.style.left = '-9999px'
      document.body.appendChild(area)
      area.select()
      document.execCommand('copy')
      area.remove()
    }
    showCopyTooltip(button, '已复制')
  } catch (error) {
    console.error(error)
    showCopyTooltip(button, '复制失败')
  }
}

/** @type {WeakMap<HTMLElement, { hide?: number, clear?: number }>} */
const copyTooltipTimers = new WeakMap()

function showCopyTooltip(button, message) {
  const previousTimers = copyTooltipTimers.get(button)
  if (previousTimers?.hide) window.clearTimeout(previousTimers.hide)
  if (previousTimers?.clear) window.clearTimeout(previousTimers.clear)

  button.dataset.tooltip = message
  // 强制重绘，确保连续点击时也能重新播放淡入
  button.classList.remove('is-copied')
  void button.offsetWidth
  button.classList.add('is-copied')

  const hide = window.setTimeout(() => {
    button.classList.remove('is-copied')
    const clear = window.setTimeout(() => {
      delete button.dataset.tooltip
      copyTooltipTimers.delete(button)
    }, 240)
    copyTooltipTimers.set(button, { clear })
  }, 1200)
  copyTooltipTimers.set(button, { hide })
}

toggleGroupsBtn?.addEventListener('click', () => {
  toggleAllChecked(groupsEl)
  refresh()
})

toggleCatsBtn?.addEventListener('click', () => {
  toggleAllChecked(catsEl)
  refresh()
})

groupsEl.addEventListener('change', refresh)
catsEl.addEventListener('change', refresh)

calendarPrevBtn?.addEventListener('click', () => {
  if (calendarView === 'week') calendarCursor = shiftDay(calendarCursor, -7)
  else if (calendarView === 'day') calendarCursor = shiftDay(calendarCursor, -1)
  else calendarCursor = shiftMonth(calendarCursor, -1)
  refreshCalendarOnly()
})
calendarNextBtn?.addEventListener('click', () => {
  if (calendarView === 'week') calendarCursor = shiftDay(calendarCursor, 7)
  else if (calendarView === 'day') calendarCursor = shiftDay(calendarCursor, 1)
  else calendarCursor = shiftMonth(calendarCursor, 1)
  refreshCalendarOnly()
})
calendarTodayBtn?.addEventListener('click', () => {
  calendarCursor = startOfDay(new Date())
  refreshCalendarOnly()
})

for (const button of calendarViewBtns) {
  button.addEventListener('click', () => {
    const nextView = button.getAttribute('data-calendar-view')
    if (nextView !== 'month' && nextView !== 'week' && nextView !== 'day') return
    calendarView = nextView
    refreshCalendarOnly()
  })
}

themeToggleBtn?.addEventListener('click', () => {
  setTheme(getCurrentTheme() === 'light' ? 'dark' : 'light')
})

// 事件委托：静态区动态按钮 + 自定义区复制
document.addEventListener('click', (event) => {
  const target = event.target
  if (!(target instanceof Element)) return

  const copyById = target.closest('[data-copy]')
  if (copyById instanceof HTMLElement) {
    event.preventDefault()
    const text =
      document.getElementById(copyById.getAttribute('data-copy') ?? '')?.textContent ?? ''
    void copyText(text, copyById)
    return
  }

  const copyByText = target.closest('[data-copy-text]')
  if (copyByText instanceof HTMLElement) {
    event.preventDefault()
    void copyText(copyByText.getAttribute('data-copy-text') ?? '', copyByText)
  }
})

async function loadStats() {
  try {
    const response = await fetch('/data/news.json', { cache: 'no-cache' })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()
    newsItems = data.items ?? []
    feedRev = String(data.scrapedAt ?? '')
      .replace(/[-:.TZ]/g, '')
      .slice(0, 14)
    refresh()
  } catch {
    if (filterStatusEl) {
      filterStatusEl.textContent = '尚未加载到 news.json（先运行 scrape / build-feeds）'
    }
    refresh()
  }
}

async function loadHolidays() {
  try {
    const response = await fetch(HOLIDAY_API_URL, { cache: 'force-cache' })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()
    holidayNames = new Map(
      Object.entries(data).filter(
        ([date, name]) => /^\d{4}-\d{2}-\d{2}$/.test(date) && typeof name === 'string',
      ),
    )
    refreshCalendarOnly()
  } catch (error) {
    console.warn('日本公共节假日加载失败', error)
  }
}

refresh()
void loadStats()
void loadHolidays()
