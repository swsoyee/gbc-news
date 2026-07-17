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
const statsEl = document.getElementById('stats')
const filterStatusEl = document.getElementById('filter-status')
const rssUrlEl = document.getElementById('rss-url')
const icsUrlEl = document.getElementById('ics-url')
const rssOpen = document.getElementById('rss-open')
const icsOpen = document.getElementById('ics-open')
const calendarGridEl = document.getElementById('calendar-grid')
const calendarNoteEl = document.getElementById('calendar-note')
const calendarMonthLabelEl = document.getElementById('calendar-month-label')
const calendarPrevBtn = document.getElementById('calendar-prev')
const calendarNextBtn = document.getElementById('calendar-next')
const calendarTodayBtn = document.getElementById('calendar-today')

const CHIPS_PER_DAY = 3

/** 当前看板月份：本地时区的年月（日固定为 1） */
let calendarCursor = startOfMonth(new Date())

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

function withFeedRev(url) {
  if (!feedRev) return url
  const parsed = new URL(url, window.location.origin)
  parsed.searchParams.set('v', feedRev)
  return parsed.toString()
}

function selectedValues(container) {
  return [...container.querySelectorAll('input:checked')].map((input) => input.value)
}

function setAllChecked(container, checked) {
  for (const input of container.querySelectorAll('input[type="checkbox"]')) {
    input.checked = checked
  }
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

function filterNewsItems(groups, categories) {
  const allGroups = groups.length === 0 || groups.length === GROUPS.length
  const allCategories = categories.length === 0 || categories.length === CATEGORIES.length
  const groupSet = new Set(groups)
  const catSet = new Set(categories)

  return newsItems.filter((item) => {
    const groupOk = allGroups || (item.groups ?? []).some((g) => groupSet.has(g))
    const catOk = allCategories || (item.categories ?? []).some((c) => catSet.has(c))
    return groupOk && catOk
  })
}

function buildFeedUrls(groups, categories) {
  const origin = window.location.origin
  // 未勾选 = 该维不过滤（等同全部）；与「全选」同义，避免空选得到空订阅
  const allGroups = groups.length === 0 || groups.length === GROUPS.length
  const allCategories = categories.length === 0 || categories.length === CATEGORIES.length

  if (allGroups && allCategories) {
    return {
      mode: 'all',
      rss: `${origin}/feeds/all.xml`,
      ics: withFeedRev(`${origin}/feeds/all.ics`),
    }
  }

  if (allGroups && categories.length === 1) {
    const id = categories[0]
    return {
      mode: 'category',
      rss: `${origin}/feeds/${id}.xml`,
      ics: withFeedRev(`${origin}/feeds/${id}.ics`),
    }
  }

  if (allCategories && groups.length === 1) {
    const id = groups[0]
    return {
      mode: 'group',
      rss: `${origin}/feeds/group-${id}.xml`,
      ics: withFeedRev(`${origin}/feeds/group-${id}.ics`),
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

function labelList(ids, catalog) {
  if (ids.length === 0 || ids.length === catalog.length) return '全部'
  const map = Object.fromEntries(catalog.map((item) => [item.id, item.label]))
  return ids.map((id) => map[id] ?? id).join('、')
}

function localTodayIso() {
  return toIsoDate(new Date())
}

function toIsoDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function shiftMonth(date, delta) {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1)
}

function formatMonthLabel(date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月`
}

function eventKindLabel(kind) {
  return kind === 'sale' ? '発売' : '開催'
}

function mondayBasedWeekday(date) {
  return (date.getDay() + 6) % 7
}

function buildMonthCells(cursor) {
  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const first = new Date(year, month, 1)
  const startOffset = mondayBasedWeekday(first)
  const start = new Date(year, month, 1 - startOffset)
  const cells = []
  for (let i = 0; i < 42; i += 1) {
    const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    const date = toIsoDate(day)
    cells.push({
      date,
      dayNum: day.getDate(),
      inMonth: day.getMonth() === month,
      isRestDay: day.getDay() === 0 || day.getDay() === 6,
      holidayName: holidayNames.get(date),
    })
  }
  return cells
}

function buildCalendarEvents(groups, categories) {
  const events = []
  for (const item of filterNewsItems(groups, categories)) {
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
        startTime: eventDate.startTime,
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
      }
    })
    .sort(
      (a, b) =>
        a.startColumn - b.startColumn ||
        b.endColumn - a.endColumn ||
        a.event.item.title.localeCompare(b.event.item.title),
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
  const startMark = continuesBefore ? '… ' : ''
  const endMark = continuesAfter ? ' …' : ''
  const time = event.startTime && !continuesBefore ? `${event.startTime} ` : ''
  return `${kind} ${startMark}${time}${event.item.title}${endMark}`
}

function renderCalendar(groups, categories) {
  if (!calendarGridEl) return

  const events = buildCalendarEvents(groups, categories)
  const cells = buildMonthCells(calendarCursor)
  const today = localTodayIso()
  const monthStart = toIsoDate(calendarCursor)
  const monthEnd = toIsoDate(
    new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + 1, 0),
  )
  const monthEventCount = events.filter(
    (event) => event.date <= monthEnd && event.endDate >= monthStart,
  ).length

  if (calendarMonthLabelEl) calendarMonthLabelEl.textContent = formatMonthLabel(calendarCursor)
  if (calendarNoteEl) {
    calendarNoteEl.textContent =
      monthEventCount > 0
        ? `本月 ${monthEventCount} 件（受当前筛选影响）`
        : '本月当前筛选下没有活动'
  }

  calendarGridEl.replaceChildren()
  for (let weekStart = 0; weekStart < cells.length; weekStart += 7) {
    const weekCells = cells.slice(weekStart, weekStart + 7)
    const weekEl = document.createElement('div')
    weekEl.className = 'calendar-week'

    for (const [dayIndex, cell] of weekCells.entries()) {
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

    const segments = buildWeekSegments(events, weekCells)
    for (const segment of segments) {
      const { event } = segment
      const chip = document.createElement('a')
      chip.className = event.kind === 'sale' ? 'calendar-chip is-sale' : 'calendar-chip'
      if (event.endDate > event.date) chip.classList.add('is-span')
      if (segment.lane >= CHIPS_PER_DAY) chip.classList.add('is-overflow')
      chip.style.gridColumn = `${segment.startColumn + 1} / ${segment.endColumn + 2}`
      chip.style.setProperty('--calendar-lane', String(segment.lane))
      chip.href = event.item.url
      chip.target = '_blank'
      chip.rel = 'noopener'
      chip.title = `${eventKindLabel(event.kind)} ${event.date}～${event.endDate} ${event.item.title}`
      chip.textContent = chipLabel(segment)
      weekEl.appendChild(chip)
    }

    let hasOverflow = false
    for (let dayIndex = 0; dayIndex < weekCells.length; dayIndex += 1) {
      const hiddenCount = segments.filter(
        (segment) =>
          segment.lane >= CHIPS_PER_DAY &&
          segment.startColumn <= dayIndex &&
          dayIndex <= segment.endColumn,
      ).length
      if (hiddenCount > 0) {
        hasOverflow = true
        const more = document.createElement('div')
        more.className = 'calendar-more'
        more.style.gridColumn = String(dayIndex + 1)
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
      const ics = withFeedRev(`${location.origin}/feeds/group-${group.id}.ics`)
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
      const ics = withFeedRev(`${location.origin}/feeds/${category.id}.ics`)
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

function toWebcal(url) {
  return url.replace(/^https:/, 'webcal:').replace(/^http:/, 'webcal:')
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
    filterStatusEl.textContent = `当前筛选：组合「${groupLabel}」× 分类「${catLabel}」→ 匹配资讯 ${counts.items} 条（含活动日 ${counts.dated} 条，可进日历）｜订阅模式 ${mode}`
  }

  renderCalendar(groups, categories)
  renderStaticLinks(groups, categories)
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

document.getElementById('select-all-groups').addEventListener('click', () => {
  setAllChecked(groupsEl, true)
  refresh()
})

document.getElementById('clear-all-groups').addEventListener('click', () => {
  // 清空 = 该维不过滤（全部），与按钮文案一致
  setAllChecked(groupsEl, false)
  refresh()
})

document.getElementById('select-all').addEventListener('click', () => {
  setAllChecked(catsEl, true)
  refresh()
})

document.getElementById('clear-all').addEventListener('click', () => {
  setAllChecked(catsEl, false)
  refresh()
})

groupsEl.addEventListener('change', refresh)
catsEl.addEventListener('change', refresh)

calendarPrevBtn?.addEventListener('click', () => {
  calendarCursor = shiftMonth(calendarCursor, -1)
  refreshCalendarOnly()
})
calendarNextBtn?.addEventListener('click', () => {
  calendarCursor = shiftMonth(calendarCursor, 1)
  refreshCalendarOnly()
})
calendarTodayBtn?.addEventListener('click', () => {
  calendarCursor = startOfMonth(new Date())
  refreshCalendarOnly()
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

    const groupCounts = Object.fromEntries(GROUPS.map((group) => [group.id, 0]))
    const catCounts = Object.fromEntries(CATEGORIES.map((category) => [category.id, 0]))
    let withEvent = 0
    let withTime = 0
    for (const item of newsItems) {
      if (item.eventDates?.length) withEvent += 1
      for (const eventDate of item.eventDates ?? []) {
        if (eventDate.startTime) withTime += 1
      }
      for (const group of item.groups ?? []) {
        if (group in groupCounts) groupCounts[group] += 1
      }
      for (const category of item.categories ?? []) {
        if (category in catCounts) catCounts[category] += 1
      }
    }
    const groupSummary = GROUPS.map((group) => `${group.label} ${groupCounts[group.id]}`).join(
      ' · ',
    )
    const catSummary = CATEGORIES.map(
      (category) => `${category.label} ${catCounts[category.id]}`,
    ).join(' · ')
    statsEl.textContent = `资讯 ${data.count ?? newsItems.length} 条｜有活动日 ${withEvent} 条｜含时刻 ${withTime} 条｜组合 ${groupSummary}｜分类 ${catSummary}`
    refresh()
  } catch {
    statsEl.textContent = '尚未加载到 news.json（先运行 scrape / build-feeds）'
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
