import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildIcal, buildRss } from '../src/feeds/build.js'
import { CATEGORY_IDS, CATEGORY_LABELS, type CategoryId } from '../src/models/categories.js'
import {
  assertNewsItem,
  filterItemsByCategories,
  filterItemsForCalendar,
  type NewsItem,
} from '../src/models/item.js'
import { extractEventSchedule } from '../src/utils/event-time.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dataPath = join(root, 'data/gbc-news/latest.json')
const publicDataPath = join(root, 'public/data/news.json')
const feedsDir = join(root, 'public/feeds')

interface Snapshot {
  items: NewsItem[]
  scrapedAt?: string
  count?: number
  sourceId?: string
  maxPages?: number
}

async function main(): Promise<void> {
  let rawText: string
  try {
    rawText = await readFile(dataPath, 'utf8')
  } catch {
    console.warn(
      '[warn] data/gbc-news/latest.json 不存在，跳过 feed 生成（请先 npm run scrape:gbc）',
    )
    return
  }

  const raw = JSON.parse(rawText) as Snapshot
  if (!Array.isArray(raw.items) || raw.items.length === 0) {
    throw new Error('data/gbc-news/latest.json 无有效 items，拒绝生成空订阅')
  }

  // 回填：仅当快照缺少 eventAt 时，用标题/摘要尝试解析
  raw.items = raw.items.map((item) => {
    if (item.eventAt) return item
    const schedule = extractEventSchedule(item.title, item.summary ?? '', item.publishedAt)
    if (!schedule) return item
    return {
      ...item,
      eventAt: schedule.eventAt,
      ...(schedule.eventEndAt ? { eventEndAt: schedule.eventEndAt } : {}),
    }
  })

  for (const item of raw.items) assertNewsItem(item)

  const siteUrl = process.env.SITE_URL ?? 'https://gbc-news.example.com'
  await mkdir(dirname(publicDataPath), { recursive: true })
  await mkdir(feedsDir, { recursive: true })

  const snapshot = { ...raw, count: raw.items.length }
  await writeFile(dataPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8')
  await writeFile(publicDataPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8')

  // RSS：全部分类都有（含无发生日的资讯）
  await writeRss('all', raw.items, siteUrl)
  for (const category of CATEGORY_IDS) {
    const filtered = filterItemsByCategories(raw.items, [category])
    await writeRss(category, filtered, siteUrl)
  }

  // ICS：仅含事件发生日；各分类各自一份
  const calendarItems = filterItemsForCalendar(raw.items).sort((a, b) =>
    (a.eventAt ?? '').localeCompare(b.eventAt ?? ''),
  )
  await writeIcs('all', calendarItems, siteUrl)
  for (const category of CATEGORY_IDS) {
    const filtered = filterItemsForCalendar(filterItemsByCategories(raw.items, [category])).sort(
      (a, b) => (a.eventAt ?? '').localeCompare(b.eventAt ?? ''),
    )
    await writeIcs(category, filtered, siteUrl)
  }

  console.log(`[info] build-feeds done items=${raw.items.length} calendar=${calendarItems.length}`)
}

async function writeRss(name: string, items: NewsItem[], siteUrl: string): Promise<void> {
  const label = name === 'all' ? '全部' : (CATEGORY_LABELS[name as CategoryId]?.zh ?? name)
  const meta = {
    title: `gbc-news · ${label}`,
    homeUrl: `${siteUrl}/`,
    feedUrl: `${siteUrl}/feeds/${name}.xml`,
    description: `ガールズバンドクライ 公式ニュース（${label}）`,
  }
  await writeFile(join(feedsDir, `${name}.xml`), buildRss(items, meta), 'utf8')
}

async function writeIcs(name: string, items: NewsItem[], siteUrl: string): Promise<void> {
  const label = name === 'all' ? '全部' : (CATEGORY_LABELS[name as CategoryId]?.zh ?? name)
  const meta = {
    title: `gbc-news · ${label}`,
    homeUrl: `${siteUrl}/`,
    feedUrl: `${siteUrl}/feeds/${name}.ics`,
    description: `ガールズバンドクライ イベント（${label}）`,
  }
  // 即使暂时没有事件也写文件，保证「各分类都有 ICS」链接稳定
  await writeFile(join(feedsDir, `${name}.ics`), buildIcal(items, meta), 'utf8')
}

main().catch((error: unknown) => {
  console.error('[error]', error)
  process.exitCode = 1
})
