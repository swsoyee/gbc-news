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
const tipEl = document.getElementById('cal-tip')
const rssUrlEl = document.getElementById('rss-url')
const icsUrlEl = document.getElementById('ics-url')
const rssOpen = document.getElementById('rss-open')
const icsOpen = document.getElementById('ics-open')

/** 来自 news.json scrapedAt，用于 ICS URL ?v= 强制日历客户端当新订阅拉取 */
let feedRev = ''

for (const group of GROUPS) {
  const label = document.createElement('label')
  label.className = 'cat'
  label.innerHTML = `<input type="checkbox" value="${group.id}" /> <span>${group.label}</span>`
  groupsEl.appendChild(label)
}

for (const category of CATEGORIES) {
  const label = document.createElement('label')
  label.className = 'cat'
  label.innerHTML = `<input type="checkbox" value="${category.id}" /> <span>${category.label}</span>`
  catsEl.appendChild(label)
}

function withFeedRev(url) {
  if (!feedRev) return url
  const parsed = new URL(url, window.location.origin)
  parsed.searchParams.set('v', feedRev)
  return parsed.toString()
}

function renderStaticLinks() {
  if (groupLinksEl) {
    groupLinksEl.replaceChildren()
    for (const group of GROUPS) {
      const ics = withFeedRev(`${location.origin}/feeds/group-${group.id}.ics`)
      const row = document.createElement('div')
      row.className = 'link-row'
      row.innerHTML = `
      <strong>${group.label}</strong>
      <code>${ics}</code>
      <div class="actions">
        <a class="btn primary" href="${ics.replace(/^https:/, 'webcal:').replace(/^http:/, 'webcal:')}">订阅日历</a>
        <a class="btn" href="/feeds/group-${group.id}.xml" target="_blank" rel="noopener">RSS</a>
      </div>
    `
      groupLinksEl.appendChild(row)
    }
  }

  if (catLinksEl) {
    catLinksEl.replaceChildren()
    for (const category of CATEGORIES) {
      const ics = withFeedRev(`${location.origin}/feeds/${category.id}.ics`)
      const row = document.createElement('div')
      row.className = 'link-row'
      row.innerHTML = `
      <strong>${category.label}</strong>
      <code>${ics}</code>
      <div class="actions">
        <a class="btn primary" href="${ics.replace(/^https:/, 'webcal:').replace(/^http:/, 'webcal:')}">订阅日历</a>
        <a class="btn" href="/feeds/${category.id}.xml" target="_blank" rel="noopener">RSS</a>
      </div>
    `
      catLinksEl.appendChild(row)
    }
  }
}

document.getElementById('select-all-groups').addEventListener('click', () => {
  for (const input of groupsEl.querySelectorAll('input')) input.checked = true
  refresh()
})

document.getElementById('clear-all-groups').addEventListener('click', () => {
  for (const input of groupsEl.querySelectorAll('input')) input.checked = false
  refresh()
})

document.getElementById('select-all').addEventListener('click', () => {
  for (const input of catsEl.querySelectorAll('input')) input.checked = true
  refresh()
})

document.getElementById('clear-all').addEventListener('click', () => {
  for (const input of catsEl.querySelectorAll('input')) input.checked = false
  refresh()
})

groupsEl.addEventListener('change', refresh)
catsEl.addEventListener('change', refresh)

for (const button of document.querySelectorAll('[data-copy]')) {
  button.addEventListener('click', async () => {
    const id = button.getAttribute('data-copy')
    const text = document.getElementById(id)?.textContent ?? ''
    await navigator.clipboard.writeText(text)
    button.textContent = '已复制'
    setTimeout(() => {
      button.textContent = id === 'rss-url' ? '复制 RSS' : '复制日历链接'
    }, 1200)
  })
}

function selectedGroups() {
  return [...groupsEl.querySelectorAll('input:checked')].map((input) => input.value)
}

function selectedCategories() {
  return [...catsEl.querySelectorAll('input:checked')].map((input) => input.value)
}

function buildFeedUrls(groups, categories) {
  const origin = window.location.origin
  const allGroups = groups.length === 0 || groups.length === GROUPS.length
  const allCategories = categories.length === 0 || categories.length === CATEGORIES.length

  if (allGroups && allCategories) {
    return {
      rss: `${origin}/feeds/all.xml`,
      ics: withFeedRev(`${origin}/feeds/all.ics`),
    }
  }

  if (allGroups && categories.length === 1) {
    const id = categories[0]
    return {
      rss: `${origin}/feeds/${id}.xml`,
      ics: withFeedRev(`${origin}/feeds/${id}.ics`),
    }
  }

  if (allCategories && groups.length === 1) {
    const id = groups[0]
    return {
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

  return { rss: rss.toString(), ics: ics.toString() }
}

function refresh() {
  const groups = selectedGroups()
  const categories = selectedCategories()
  const { rss, ics } = buildFeedUrls(groups, categories)
  rssUrlEl.textContent = rss
  icsUrlEl.textContent = ics
  rssOpen.href = rss
  icsOpen.href = ics.replace(/^https:/, 'webcal:').replace(/^http:/, 'webcal:')

  if (tipEl) {
    tipEl.textContent =
      '有开场/开演时刻的条目会出现在当天具体钟点（不是全天栏）。日历 App 常强缓存：请删掉旧订阅后，用带 ?v= 的新链接重新添加。组合与分类维间 AND、维内 OR。'
  }
}

async function loadStats() {
  try {
    const response = await fetch('/data/news.json', { cache: 'no-cache' })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()
    feedRev = String(data.scrapedAt ?? '')
      .replace(/[-:.TZ]/g, '')
      .slice(0, 14)
    renderStaticLinks()
    refresh()

    const groupCounts = Object.fromEntries(GROUPS.map((group) => [group.id, 0]))
    const catCounts = Object.fromEntries(CATEGORIES.map((category) => [category.id, 0]))
    let withEvent = 0
    let withTime = 0
    for (const item of data.items ?? []) {
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
    statsEl.textContent = `资讯 ${data.count ?? data.items?.length ?? 0} 条｜有活动日 ${withEvent} 条｜含时刻 ${withTime} 条｜组合 ${groupSummary}｜分类 ${catSummary}`
  } catch {
    statsEl.textContent = '尚未加载到 news.json（先运行 scrape / build-feeds）'
    renderStaticLinks()
    refresh()
  }
}

renderStaticLinks()
refresh()
loadStats()
