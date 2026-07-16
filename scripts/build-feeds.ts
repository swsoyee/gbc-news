import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildIcal, buildRss } from '../src/feeds/build.js'
import { expandEventDates } from '../src/feeds/expand.js'
import { CATEGORY_IDS, CATEGORY_LABELS, type CategoryId } from '../src/models/categories.js'
import { GROUP_IDS, GROUP_LABELS } from '../src/models/groups.js'
import { assertNewsItem, filterItems, type NewsItem } from '../src/models/item.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const sourcePaths = [
  join(root, 'data/gbc-news/latest.json'),
  join(root, 'data/gbc-firstriff/latest.json'),
  join(root, 'data/collabo-cafe/latest.json'),
]
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
  const merged: NewsItem[] = []
  const sources: string[] = []

  for (const dataPath of sourcePaths) {
    let rawText: string
    try {
      rawText = await readFile(dataPath, 'utf8')
    } catch {
      console.warn(`[warn] ${dataPath} 不存在，跳过该源`)
      continue
    }

    const raw = JSON.parse(rawText) as Snapshot
    if (!Array.isArray(raw.items) || raw.items.length === 0) {
      console.warn(`[warn] ${dataPath} 无有效 items，跳过`)
      continue
    }

    for (const item of raw.items) assertNewsItem(item)
    merged.push(...raw.items)
    sources.push(raw.sourceId ?? dataPath)
  }

  if (merged.length === 0) {
    throw new Error('无可用资讯快照，拒绝生成空订阅（请先 scrape）')
  }

  merged.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))

  const siteUrl = process.env.SITE_URL ?? 'https://gbc-news.example.com'
  await mkdir(dirname(publicDataPath), { recursive: true })
  await mkdir(feedsDir, { recursive: true })

  const snapshot = {
    scrapedAt: new Date().toISOString(),
    sources,
    count: merged.length,
    items: merged,
  }
  await writeFile(publicDataPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8')

  const allEntries = expandEventDates(merged)
  if (allEntries.length === 0) {
    throw new Error('展开后无活动日期条目，拒绝写出空 RSS/iCal')
  }

  await writeRss('all', allEntries, siteUrl)
  await writeIcs('all', allEntries, siteUrl)

  for (const category of CATEGORY_IDS) {
    const filtered = filterItems(merged, { categories: [category] })
    const entries = expandEventDates(filtered)
    await writeRss(category, entries, siteUrl)
    await writeIcs(category, entries, siteUrl)
  }

  for (const group of GROUP_IDS) {
    const filtered = filterItems(merged, { groups: [group] })
    const entries = expandEventDates(filtered)
    await writeRss(`group-${group}`, entries, siteUrl, GROUP_LABELS[group].zh)
    await writeIcs(`group-${group}`, entries, siteUrl, GROUP_LABELS[group].zh)
  }

  console.log(
    `[info] build-feeds done items=${merged.length} feedEntries=${allEntries.length} sources=${sources.join(',')}`,
  )
}

async function writeRss(
  name: string,
  entries: ReturnType<typeof expandEventDates>,
  siteUrl: string,
  labelOverride?: string,
): Promise<void> {
  const label =
    labelOverride ?? (name === 'all' ? '全部' : (CATEGORY_LABELS[name as CategoryId]?.zh ?? name))
  const meta = {
    title: `gbc-news · ${label}`,
    homeUrl: `${siteUrl}/`,
    feedUrl: `${siteUrl}/feeds/${name}.xml`,
    description: `ガールズバンドクライ 公式ニュース（${label}）`,
  }
  await writeFile(join(feedsDir, `${name}.xml`), buildRss(entries, meta), 'utf8')
}

async function writeIcs(
  name: string,
  entries: ReturnType<typeof expandEventDates>,
  siteUrl: string,
  labelOverride?: string,
): Promise<void> {
  const label =
    labelOverride ?? (name === 'all' ? '全部' : (CATEGORY_LABELS[name as CategoryId]?.zh ?? name))
  const meta = {
    title: `gbc-news · ${label}`,
    homeUrl: `${siteUrl}/`,
    feedUrl: `${siteUrl}/feeds/${name}.ics`,
    description: `ガールズバンドクライ イベント（${label}）`,
  }
  await writeFile(join(feedsDir, `${name}.ics`), buildIcal(entries, meta), 'utf8')
}

main().catch((error: unknown) => {
  console.error('[error]', error)
  process.exitCode = 1
})
