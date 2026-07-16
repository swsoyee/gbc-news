const CATEGORIES = [
  { id: 'live', label: 'Live' },
  { id: 'event', label: '活动' },
  { id: 'goods', label: '周边' },
  { id: 'music', label: '曲目' },
  { id: 'cinema', label: '剧场/映像' },
  { id: 'media', label: '媒体' },
  { id: 'other', label: '其他' },
]

const catsEl = document.getElementById('cats')
const statsEl = document.getElementById('stats')
const tipEl = document.getElementById('cal-tip')
const rssUrlEl = document.getElementById('rss-url')
const icsUrlEl = document.getElementById('ics-url')
const rssOpen = document.getElementById('rss-open')
const icsOpen = document.getElementById('ics-open')

for (const category of CATEGORIES) {
  const label = document.createElement('label')
  label.className = 'cat'
  label.innerHTML = `<input type="checkbox" value="${category.id}" /> <span>${category.label}</span>`
  catsEl.appendChild(label)
}

document.getElementById('select-all').addEventListener('click', () => {
  for (const input of catsEl.querySelectorAll('input')) input.checked = true
  refresh()
})

document.getElementById('clear-all').addEventListener('click', () => {
  for (const input of catsEl.querySelectorAll('input')) input.checked = false
  refresh()
})

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

function selectedCategories() {
  return [...catsEl.querySelectorAll('input:checked')].map((input) => input.value)
}

function buildFeedUrls(categories) {
  const origin = window.location.origin
  // Apple / Google 对静态 .ics 订阅更稳；全选或未选 → all；单选 → 分类静态文件
  if (categories.length === 0 || categories.length === CATEGORIES.length) {
    return {
      rss: `${origin}/feeds/all.xml`,
      ics: `${origin}/feeds/all.ics`,
      mode: 'static-all',
    }
  }
  if (categories.length === 1) {
    const id = categories[0]
    return {
      rss: `${origin}/feeds/${id}.xml`,
      ics: `${origin}/feeds/${id}.ics`,
      mode: 'static-one',
    }
  }
  const rss = new URL('/api/feed', origin)
  rss.searchParams.set('format', 'rss')
  rss.searchParams.set('categories', categories.join(','))
  const ics = new URL('/api/feed', origin)
  ics.searchParams.set('format', 'ics')
  ics.searchParams.set('categories', categories.join(','))
  return { rss: rss.toString(), ics: ics.toString(), mode: 'api-multi' }
}

function refresh() {
  const categories = selectedCategories()
  const { rss, ics, mode } = buildFeedUrls(categories)
  rssUrlEl.textContent = rss
  icsUrlEl.textContent = ics
  rssOpen.href = rss
  icsOpen.href = ics.replace(/^https:/, 'webcal:').replace(/^http:/, 'webcal:')

  if (tipEl) {
    if (mode === 'api-multi') {
      tipEl.textContent =
        '多分类组合目前走动态链接；若日历仍空白，请改用「全选」生成的 /feeds/all.ics，或只选一个分类。事件按新闻发布日显示，请翻到 6–7 月查看。'
    } else {
      tipEl.textContent =
        '日历事件按官网新闻的发布日显示（全天）。当前数据多在 2026年6–7月，请翻到那些日期；今天若无新稿会是空的。'
    }
  }
}

async function loadStats() {
  try {
    const response = await fetch('/data/news.json', { cache: 'no-cache' })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()
    const counts = Object.fromEntries(CATEGORIES.map((category) => [category.id, 0]))
    for (const item of data.items ?? []) {
      for (const category of item.categories ?? []) {
        if (category in counts) counts[category] += 1
      }
    }
    const summary = CATEGORIES.map((category) => `${category.label} ${counts[category.id]}`).join(
      ' · ',
    )
    statsEl.textContent = `当前快照 ${data.count ?? data.items?.length ?? 0} 条（前 ${data.maxPages ?? '?'} 页）｜${summary}`
  } catch {
    statsEl.textContent = '尚未加载到 news.json（先运行 scrape / build-feeds）'
  }
}

refresh()
loadStats()
