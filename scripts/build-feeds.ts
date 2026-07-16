import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildIcal, buildRss } from '../src/feeds/build.js'
import { CATEGORY_IDS, CATEGORY_LABELS, type CategoryId } from '../src/models/categories.js'
import { assertNewsItem, filterItemsByCategories, type NewsItem } from '../src/models/item.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dataPath = join(root, 'data/gbc-news/latest.json')
const publicDataPath = join(root, 'public/data/news.json')
const feedsDir = join(root, 'public/feeds')

interface Snapshot {
  items: NewsItem[]
  scrapedAt?: string
}

async function main(): Promise<void> {
  let rawText: string
  try {
    rawText = await readFile(dataPath, 'utf8')
  } catch {
    console.warn('[warn] data/gbc-news/latest.json 不存在，跳过 feed 生成（请先 npm run scrape:gbc）')
    return
  }

  const raw = JSON.parse(rawText) as Snapshot
  if (!Array.isArray(raw.items) || raw.items.length === 0) {
    throw new Error('data/gbc-news/latest.json 无有效 items，拒绝生成空订阅')
  }
  for (const item of raw.items) assertNewsItem(item)

  const siteUrl = process.env.SITE_URL ?? 'https://gbc-news.example.com'
  await mkdir(dirname(publicDataPath), { recursive: true })
  await mkdir(feedsDir, { recursive: true })
  await writeFile(publicDataPath, `${JSON.stringify(raw, null, 2)}\n`, 'utf8')

  await writeFeed('all', raw.items, siteUrl)
  for (const category of CATEGORY_IDS) {
    const filtered = filterItemsByCategories(raw.items, [category])
    if (filtered.length === 0) continue
    await writeFeed(category, filtered, siteUrl)
  }

  console.log(`[info] build-feeds done items=${raw.items.length}`)
}

async function writeFeed(name: string, items: NewsItem[], siteUrl: string): Promise<void> {
  const label =
    name === 'all' ? '全部' : (CATEGORY_LABELS[name as CategoryId]?.zh ?? name)
  const meta = {
    title: `gbc-news · ${label}`,
    homeUrl: `${siteUrl}/`,
    feedUrl: `${siteUrl}/feeds/${name}.xml`,
    description: `ガールズバンドクライ 公式ニュース（${label}）`,
  }
  await writeFile(join(feedsDir, `${name}.xml`), buildRss(items, meta), 'utf8')
  await writeFile(
    join(feedsDir, `${name}.ics`),
    buildIcal(items, { ...meta, feedUrl: `${siteUrl}/feeds/${name}.ics` }),
    'utf8',
  )
}

main().catch((error: unknown) => {
  console.error('[error]', error)
  process.exitCode = 1
})
