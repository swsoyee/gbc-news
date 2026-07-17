/**
 * 用现有 latest.json 的 URL 重抓详情，仅刷新 eventDates（期间抽取升级后用）。
 * 用法：tsx scripts/reenrich-event-dates.ts [gbc-news|gbc-firstriff|all]
 *
 * 注意：历史维护脚本，目前只支持 gbc-news / gbc-firstriff。
 * collabo-cafe / gamepedia 请用各自 scrape 脚本重抓，不要在此扩展硬编码列表时绕过 SOURCE_IDS 约定。
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { extractEventDates } from '../src/categories/extract-event-dates.js'
import { assertNewsItem, type NewsItem } from '../src/models/item.js'
import { fetchText } from '../src/utils/http.js'
import { parseNewsDetail as parseGbcDetail } from '../src/scrapers/gbc-news/parse-detail.js'
import { parseNewsDetail as parseFirstriffDetail } from '../src/scrapers/gbc-firstriff/parse.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const DELAY_MS = 350

type SourceKey = 'gbc-news' | 'gbc-firstriff'

const SOURCES: Record<
  SourceKey,
  {
    path: string
    parse: (html: string) => {
      title: string
      bodyText: string
      publishedAt?: string
      summary?: string
    }
  }
> = {
  'gbc-news': {
    path: join(root, 'data/gbc-news/latest.json'),
    parse: parseGbcDetail,
  },
  'gbc-firstriff': {
    path: join(root, 'data/gbc-firstriff/latest.json'),
    parse: parseFirstriffDetail,
  },
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function reenrich(source: SourceKey): Promise<void> {
  const { path, parse } = SOURCES[source]
  const raw = JSON.parse(await readFile(path, 'utf8')) as { scrapedAt?: string; items: NewsItem[] }
  const items = raw.items
  for (const item of items) assertNewsItem(item)

  let changed = 0
  let withDates = 0
  let withPeriods = 0

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i]!
    try {
      const html = await fetchText(item.url)
      const detail = parse(html)
      const title = detail.title || item.title
      const publishedAt = detail.publishedAt || item.publishedAt
      const eventDates = extractEventDates(title, detail.bodyText, publishedAt)
      const prev = JSON.stringify(item.eventDates ?? [])
      const next = JSON.stringify(eventDates)
      if (prev !== next) {
        changed += 1
        if (eventDates.length > 0) item.eventDates = eventDates
        else delete item.eventDates
      }
      if (eventDates.length > 0) withDates += 1
      if (eventDates.some((e) => e.endDate && e.endDate > e.date)) withPeriods += 1
    } catch (error) {
      console.warn(
        `[warn] ${source} ${item.id}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }

    if ((i + 1) % 25 === 0 || i + 1 === items.length) {
      console.log(
        `[info] ${source} ${i + 1}/${items.length} changed=${changed} periods=${withPeriods}`,
      )
    }
    if (DELAY_MS > 0) await sleep(DELAY_MS)
  }

  const out = {
    ...raw,
    scrapedAt: new Date().toISOString(),
    count: items.length,
    items,
  }
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(out, null, 2)}\n`, 'utf8')
  console.log(
    `[ok] ${source} wrote ${path} items=${items.length} withDates=${withDates} withPeriods=${withPeriods} changed=${changed}`,
  )
}

async function main(): Promise<void> {
  const arg = (process.argv[2] ?? 'all') as SourceKey | 'all'
  const targets: SourceKey[] =
    arg === 'all' ? ['gbc-news', 'gbc-firstriff'] : arg in SOURCES ? [arg] : []
  if (targets.length === 0) {
    throw new Error(`Unknown source: ${arg}. Use gbc-news|gbc-firstriff|all`)
  }
  for (const source of targets) await reenrich(source)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
