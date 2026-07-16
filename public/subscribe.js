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
const catLinksEl = document.getElementById('cat-links')
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

// 各分类固定 ICS / RSS 入口（始终可见）
if (catLinksEl) {
  for (const category of CATEGORIES) {
    const row = document.createElement('div')
    row.className = 'link-row'
    row.innerHTML = `
      <strong>${category.label}</strong>
      <code>${location.origin}/feeds/${category.id}.ics</code>
      <div class="actions">
        <a class="btn primary" href="webcal://${location.host}/feeds/${category.id}.ics">订阅日历</a>
        <a class="btn" href="/feeds/${category.id}.xml" target="_blank" rel="noopener">RSS</a>
      </div>
    `
    catLinksEl.appendChild(row)
  }
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
  if (categories.length === 0 || categories.length === CATEGORIES.length) {
    return {
      rss: `${origin}/feeds/all.xml`,
      ics: `${origin}/feeds/all.ics`,
    }
  }
  if (categories.length === 1) {
    const id = categories[0]
    return {
      rss: `${origin}/feeds/${id}.xml`,
      ics: `${origin}/feeds/${id}.ics`,
    }
  }
  const rss = new URL('/api/feed', origin)
  rss.searchParams.set('format', 'rss')
  rss.searchParams.set('categories', categories.join(','))
  const ics = new URL('/api/feed', origin)
  ics.searchParams.set('format', 'ics')
  ics.searchParams.set('categories', categories.join(','))
  return { rss: rss.toString(), ics: ics.toString() }
}

function refresh() {
  const categories = selectedCategories()
  const { rss, ics } = buildFeedUrls(categories)
  rssUrlEl.textContent = rss
  icsUrlEl.textContent = ics
  rssOpen.href = rss
  icsOpen.href = ics.replace(/^https:/, 'webcal:').replace(/^http:/, 'webcal:')

  if (tipEl) {
    tipEl.textContent =
      '日历使用「事件发生日」（Live/活动举办日、发售日等），不是新闻发稿日。请翻到 2026年7–11 月等未来/举办日期查看。下方每个分类都有独立 ICS。'
  }
}

async function loadStats() {
  try {
    const response = await fetch('/data/news.json', { cache: 'no-cache' })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()
    const counts = Object.fromEntries(CATEGORIES.map((category) => [category.id, 0]))
    let withEvent = 0
    for (const item of data.items ?? []) {
      if (item.eventAt) withEvent += 1
      for (const category of item.categories ?? []) {
        if (category in counts) counts[category] += 1
      }
    }
    const summary = CATEGORIES.map((category) => `${category.label} ${counts[category.id]}`).join(
      ' · ',
    )
    statsEl.textContent = `资讯 ${data.count ?? data.items?.length ?? 0} 条｜可入日历（有发生日） ${withEvent} 条｜${summary}`
  } catch {
    statsEl.textContent = '尚未加载到 news.json（先运行 scrape / build-feeds）'
  }
}

refresh()
loadStats()
