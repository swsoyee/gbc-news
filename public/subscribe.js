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
const calendarListEl = document.getElementById('calendar-list')
const calendarNoteEl = document.getElementById('calendar-note')

const CALENDAR_LIMIT = 36

/** @type {{ title: string, url: string, groups?: string[], categories?: string[], eventDates?: { date: string, endDate?: string, kind: 'hold' | 'sale', startTime?: string }[] }[]} */
let newsItems = []

/** 来自 news.json scrapedAt，用于 ICS URL ?v= */
let feedRev = ''

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
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatMonthTitle(date) {
  const parsed = new Date(`${date}T00:00:00`)
  return `${parsed.getFullYear()}年${parsed.getMonth() + 1}月`
}

function formatDay(date) {
  return String(Number(date.slice(8, 10)))
}

function formatWeekday(date) {
  return new Intl.DateTimeFormat('zh-CN', { weekday: 'short' }).format(new Date(`${date}T00:00:00`))
}

function formatDateShort(date) {
  return `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`
}

function eventKindLabel(kind) {
  return kind === 'sale' ? '発売' : '開催'
}

function buildCalendarEvents(groups, categories) {
  const today = localTodayIso()
  const events = []

  for (const item of filterNewsItems(groups, categories)) {
    for (const eventDate of item.eventDates ?? []) {
      if (!eventDate.date || eventDate.date < today) continue
      events.push({
        item,
        date: eventDate.date,
        endDate: eventDate.endDate,
        kind: eventDate.kind,
        startTime: eventDate.startTime,
      })
    }
  }

  return events
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        (a.startTime ?? '').localeCompare(b.startTime ?? '') ||
        a.item.title.localeCompare(b.item.title),
    )
    .slice(0, CALENDAR_LIMIT)
}

function renderCalendar(groups, categories) {
  if (!calendarListEl) return

  const events = buildCalendarEvents(groups, categories)
  calendarListEl.replaceChildren()
  if (calendarNoteEl) {
    calendarNoteEl.textContent =
      events.length > 0 ? `显示未来 ${events.length} 件` : '当前筛选下没有未来活动'
  }

  if (events.length === 0) {
    const empty = document.createElement('p')
    empty.className = 'calendar-empty'
    empty.textContent = '当前筛选下没有可显示的未来活动日。'
    calendarListEl.appendChild(empty)
    return
  }

  let currentMonth = ''
  let monthEl = null
  for (const event of events) {
    const month = event.date.slice(0, 7)
    if (month !== currentMonth) {
      currentMonth = month
      monthEl = document.createElement('div')
      monthEl.className = 'calendar-month'
      const title = document.createElement('div')
      title.className = 'calendar-month-title'
      title.textContent = formatMonthTitle(event.date)
      monthEl.appendChild(title)
      calendarListEl.appendChild(monthEl)
    }
    monthEl.appendChild(buildCalendarRow(event))
  }
}

function buildCalendarRow(event) {
  const link = document.createElement('a')
  link.className = 'calendar-event'
  link.href = event.item.url
  link.target = '_blank'
  link.rel = 'noopener'

  const dateBox = document.createElement('span')
  dateBox.className = 'calendar-date'

  const day = document.createElement('span')
  day.className = 'calendar-day'
  day.textContent = formatDay(event.date)
  const weekday = document.createElement('span')
  weekday.className = 'calendar-weekday'
  weekday.textContent = formatWeekday(event.date)
  dateBox.append(day, weekday)

  if (event.endDate && event.endDate > event.date) {
    const range = document.createElement('span')
    range.className = 'calendar-range'
    range.textContent = `〜${formatDateShort(event.endDate)}`
    dateBox.appendChild(range)
  }

  const body = document.createElement('span')
  body.className = 'calendar-body'

  const title = document.createElement('span')
  title.className = 'calendar-title'
  title.textContent = event.item.title

  const meta = document.createElement('span')
  meta.className = 'calendar-meta'
  const kind = document.createElement('span')
  kind.className = 'calendar-kind'
  kind.textContent = eventKindLabel(event.kind)
  meta.appendChild(kind)
  if (event.startTime) {
    const time = document.createElement('span')
    time.textContent = event.startTime
    meta.appendChild(time)
  }
  const cats = document.createElement('span')
  cats.textContent = (event.item.categories ?? []).join(' / ')
  meta.appendChild(cats)

  body.append(title, meta)
  link.append(dateBox, body)
  return link
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

function buildLinkRow({ title, ics, rssPath, dimmed }) {
  const row = document.createElement('div')
  row.className = dimmed ? 'link-row is-dimmed' : 'link-row'

  const strong = document.createElement('strong')
  strong.textContent = title

  const code = document.createElement('code')
  code.textContent = ics

  const actions = document.createElement('div')
  actions.className = 'actions'

  const copyBtn = document.createElement('button')
  copyBtn.type = 'button'
  copyBtn.className = 'primary'
  copyBtn.textContent = '复制链接'
  copyBtn.dataset.copyText = ics

  const calLink = document.createElement('a')
  calLink.className = 'btn primary'
  calLink.href = toWebcal(ics)
  calLink.textContent = '订阅日历'

  const rssLink = document.createElement('a')
  rssLink.className = 'btn'
  rssLink.href = rssPath
  rssLink.target = '_blank'
  rssLink.rel = 'noopener'
  rssLink.textContent = 'RSS'

  actions.append(copyBtn, calLink, rssLink)
  row.append(strong, code, actions)
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
    const prev = button.textContent
    button.textContent = '已复制'
    window.setTimeout(() => {
      button.textContent = prev
    }, 1200)
  } catch (error) {
    console.error(error)
    button.textContent = '复制失败'
    window.setTimeout(() => {
      button.textContent = '复制链接'
    }, 1500)
  }
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

// 事件委托：静态区动态按钮 + 自定义区复制
document.addEventListener('click', (event) => {
  const target = event.target
  if (!(target instanceof HTMLElement)) return

  const copyId = target.getAttribute('data-copy')
  if (copyId) {
    event.preventDefault()
    const text = document.getElementById(copyId)?.textContent ?? ''
    void copyText(text, target)
    return
  }

  const copyTextValue = target.getAttribute('data-copy-text')
  if (copyTextValue) {
    event.preventDefault()
    void copyText(copyTextValue, target)
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

refresh()
loadStats()
