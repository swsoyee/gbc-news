import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildIcal, buildRss } from '../src/feeds/build.js'
import { expandEventDates } from '../src/feeds/expand.js'
import { assertNewsItem, type NewsItem } from '../src/models/item.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dataPath = join(root, 'data/collabo-cafe/latest.json')
const publicDataPath = join(root, 'public/data/collabo-cafe.json')
const feedsDir = join(root, 'public/feeds')

interface Snapshot {
  items: NewsItem[]
  scrapedAt?: string
  count?: number
  sourceId?: string
}

async function main(): Promise<void> {
  let rawText: string
  try {
    rawText = await readFile(dataPath, 'utf8')
  } catch {
    throw new Error(`${dataPath} 不存在，请先运行 npm run scrape:collabo-cafe`)
  }

  const raw = JSON.parse(rawText) as Snapshot
  if (!Array.isArray(raw.items) || raw.items.length === 0) {
    throw new Error('collabo-cafe 快照无有效 items，拒绝生成空订阅')
  }

  for (const item of raw.items) {
    assertNewsItem(item)
    if (item.sourceId !== 'collabo-cafe') {
      throw new Error(`Unexpected sourceId in collabo snapshot: ${item.sourceId}`)
    }
  }

  const items = [...raw.items].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
  const siteUrl = process.env.SITE_URL ?? 'https://gbc-news.example.com'
  const scrapedAt = new Date().toISOString()

  await mkdir(dirname(publicDataPath), { recursive: true })
  await mkdir(feedsDir, { recursive: true })

  await writeFile(
    publicDataPath,
    `${JSON.stringify(
      {
        scrapedAt,
        sourceId: 'collabo-cafe',
        count: items.length,
        items,
      },
      null,
      2,
    )}\n`,
    'utf8',
  )

  const entries = expandEventDates(items)
  if (entries.length === 0) {
    throw new Error('collabo-cafe 展开后无活动日期条目，拒绝写出空 RSS/iCal')
  }

  const rssMeta = {
    title: 'gbc-news · 协作资讯（collabo-cafe）',
    homeUrl: `${siteUrl}/`,
    feedUrl: `${siteUrl}/feeds/collabo-cafe.xml`,
    description: 'ガールズバンドクライ 协作カフェ・ポップアップ・グッズ（collabo-cafe.com）',
  }
  const icsMeta = {
    title: 'gbc-news · 协作资讯（collabo-cafe）',
    homeUrl: `${siteUrl}/`,
    feedUrl: `${siteUrl}/feeds/collabo-cafe.ics`,
    description: 'ガールズバンドクライ 协作イベント（collabo-cafe.com）',
  }

  await writeFile(join(feedsDir, 'collabo-cafe.xml'), buildRss(entries, rssMeta), 'utf8')
  await writeFile(join(feedsDir, 'collabo-cafe.ics'), buildIcal(entries, icsMeta), 'utf8')

  console.log(`[info] build-collabo-feeds done items=${items.length} feedEntries=${entries.length}`)
}

main().catch((error: unknown) => {
  console.error('[error]', error)
  process.exitCode = 1
})
