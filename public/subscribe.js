import {
  buildCalendarEvents as buildCalendarEventsCore,
  buildFeedUrls as buildFeedUrlsCore,
  buildMonthCells as buildMonthCellsCore,
  buildWeekCells as buildWeekCellsCore,
  buildWeekSegments,
  chipLabel,
  eventKindLabel,
  formatDayLabel,
  formatMonthLabel,
  formatWeekLabel,
  labelList,
  shiftDay,
  shiftMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
  toIsoDate,
  toWebcal,
  withFeedRev,
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

const CHIPS_PER_DAY = 3
const CHIPS_PER_WEEK = Number.POSITIVE_INFINITY

/** @type {'month' | 'week' | 'day'} */
let calendarView = 'month'

/** 当前看板日期：本地时区的某一天 */
let calendarCursor = startOfDay(new Date())

/** @type {{ title: string, url: string, groups?: string[], categories?: string[], eventDates?: { date: string, endDate?: string, kind: 'hold' | 'sale', startTime?: string }[] }[]} */
let newsItems = []

/** 来自 news.json scrapedAt，用于 ICS URL ?v= */
let feedRev = ''

/** @type {Map<string, string>} 日本公共节假日：ISO 日期 → 名称 */
let holidayNames = new Map()

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

function getCalendarTooltip() {
  if (calendarTooltipEl) return calendarTooltipEl
  calendarTooltipEl = document.createElement('div')
  calendarTooltipEl.className = 'calendar-event-tooltip'
  calendarTooltipEl.setAttribute('role', 'tooltip')
  document.body.appendChild(calendarTooltipEl)
  return calendarTooltipEl
}

function showCalendarTooltip(anchor, text) {
  if (calendarTooltipTimer) window.clearTimeout(calendarTooltipTimer)
  const tooltip = getCalendarTooltip()
  const rect = anchor.getBoundingClientRect()
  const showBelow = rect.top < 80
  tooltip.textContent = text
  tooltip.style.left = `${Math.min(window.innerWidth - 16, Math.max(16, rect.left + rect.width / 2))}px`
  tooltip.style.top = `${showBelow ? rect.bottom + 8 : rect.top - 8}px`
  tooltip.classList.toggle('is-below', showBelow)
  tooltip.classList.remove('is-visible')
  void tooltip.offsetWidth
  tooltip.classList.add('is-visible')
}

function hideCalendarTooltip() {
  if (!calendarTooltipEl) return
  calendarTooltipEl.classList.remove('is-visible')
  calendarTooltipTimer = window.setTimeout(() => {
    if (calendarTooltipEl) calendarTooltipEl.textContent = ''
  }, 180)
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
    const tooltipText = `${eventKindLabel(event.kind)} ${event.item.title}`
    chip.setAttribute('aria-label', tooltipText)
    chip.addEventListener('mouseenter', () => showCalendarTooltip(chip, tooltipText))
    chip.addEventListener('mouseleave', hideCalendarTooltip)
    chip.addEventListener('focus', () => showCalendarTooltip(chip, tooltipText))
    chip.addEventListener('blur', hideCalendarTooltip)
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

  calendarGridEl.appendChild(weekEl)
  if (hasOverflow) {
    weekEl.style.setProperty('--calendar-expanded-height', `${weekEl.scrollHeight}px`)
  }
}

function renderDayAgenda(events, isoDate) {
  const agenda = document.createElement('div')
  agenda.className = 'calendar-day-agenda'
  const dayEvents = events.filter((event) => event.date <= isoDate && isoDate <= event.endDate)

  if (dayEvents.length === 0) {
    const empty = document.createElement('div')
    empty.className = 'calendar-day-empty'
    empty.textContent = '当天当前筛选下没有活动'
    agenda.appendChild(empty)
    calendarGridEl.appendChild(agenda)
    return
  }

  for (const event of dayEvents) {
    const item = document.createElement('a')
    item.className = event.kind === 'sale' ? 'calendar-agenda-item is-sale' : 'calendar-agenda-item'
    item.href = event.item.url
    item.target = '_blank'
    item.rel = 'noopener'

    const meta = document.createElement('div')
    meta.className = 'calendar-agenda-meta'
    const range = event.endDate > event.date ? `${event.date}～${event.endDate}` : event.date
    const time = event.startTime && event.date === isoDate ? ` · ${event.startTime}` : ''
    meta.textContent = `${eventKindLabel(event.kind)} · ${range}${time}`

    const title = document.createElement('div')
    title.className = 'calendar-agenda-title'
    title.textContent = event.item.title

    item.append(meta, title)
    agenda.appendChild(item)
  }
  calendarGridEl.appendChild(agenda)
}

function renderCalendar(groups, categories) {
  if (!calendarGridEl) return

  hideCalendarTooltip()
  const events = buildCalendarEvents(groups, categories)
  const today = localTodayIso()
  syncCalendarViewButtons()
  syncCalendarNav()

  if (calendarBoardEl) {
    calendarBoardEl.classList.toggle('is-week-view', calendarView === 'week')
    calendarBoardEl.classList.toggle('is-day-view', calendarView === 'day')
    calendarBoardEl.dataset.view = calendarView
  }

  calendarGridEl.replaceChildren()

  if (calendarView === 'day') {
    const isoDate = toIsoDate(calendarCursor)
    if (calendarMonthLabelEl) calendarMonthLabelEl.textContent = formatDayLabel(calendarCursor)
    if (calendarMonthBgEl) calendarMonthBgEl.textContent = String(calendarCursor.getDate())
    if (calendarNoteEl) {
      const count = events.filter(
        (event) => event.date <= isoDate && isoDate <= event.endDate,
      ).length
      calendarNoteEl.textContent =
        count > 0 ? `当天 ${count} 件（受当前筛选影响）` : '当天当前筛选下没有活动'
    }
    renderDayAgenda(events, isoDate)
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
    renderWeekRow(events, weekCells, today, CHIPS_PER_WEEK)
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

  for (let weekStart = 0; weekStart < cells.length; weekStart += 7) {
    renderWeekRow(events, cells.slice(weekStart, weekStart + 7), today, CHIPS_PER_DAY)
  }
}

function refreshCalendarOnly() {
  const groups = selectedValues(groupsEl)
  const categories = selectedValues(catsEl)
  renderCalendar(groups, categories)
}

function renderStaticLinks(activeGroups, activeCategories) {
  const allGroups = activeGroups.length === 0 || activeGroups.length === GROUPS.length
  const allCategories =
    activeCategories.length === 0 || activeCategories.length === CATEGORIES.length
  const groupSet = new Set(activeGroups)
  const catSet = new Set(activeCategories)

  if (groupLinksEl) {
    groupLinksEl.replaceChildren()
    for (const group of GROUPS) {
      const active = allGroups || groupSet.has(group.id)
      const ics = withFeedRev(`${location.origin}/feeds/group-${group.id}.ics`, feedRev)
      groupLinksEl.appendChild(
        buildLinkRow({
          title: active ? group.label : `${group.label}（当前未选）`,
          ics,
          rssPath: `/feeds/group-${group.id}.xml`,
          dimmed: !active,
        }),
      )
    }
  }

  if (catLinksEl) {
    catLinksEl.replaceChildren()
    for (const category of CATEGORIES) {
      const active = allCategories || catSet.has(category.id)
      const ics = withFeedRev(`${location.origin}/feeds/${category.id}.ics`, feedRev)
      catLinksEl.appendChild(
        buildLinkRow({
          title: active ? category.label : `${category.label}（当前未选）`,
          ics,
          rssPath: `/feeds/${category.id}.xml`,
          dimmed: !active,
        }),
      )
    }
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
