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

function buildFeedUrl(format, categories) {
  const url = new URL('/api/feed', window.location.origin)
  url.searchParams.set('format', format)
  if (categories.length > 0) {
    url.searchParams.set('categories', categories.join(','))
  }
  return url.toString()
}

function refresh() {
  const categories = selectedCategories()
  const rss = buildFeedUrl('rss', categories)
  const ics = buildFeedUrl('ics', categories)
  rssUrlEl.textContent = rss
  icsUrlEl.textContent = ics
  rssOpen.href = rss
  const webcal = ics.replace(/^https:/, 'webcal:').replace(/^http:/, 'webcal:')
  icsOpen.href = webcal
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
