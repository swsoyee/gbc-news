import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertNewsItem, type NewsItem } from '../src/models/item.js'
import { scrapeCollaboCafe } from '../src/scrapers/collabo-cafe/index.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outPath = join(root, 'data/collabo-cafe/latest.json')

interface Snapshot {
  items?: NewsItem[]
}

function resolveMode(raw: string | undefined): 'incremental' | 'full' {
  const mode = (raw ?? 'incremental').toLowerCase()
  if (mode === 'full') return 'full'
  if (mode === 'incremental' || mode === 'incr') return 'incremental'
  throw new Error(`Invalid SCRAPE_MODE: ${raw}`)
}

function resolveMaxPages(raw: string | undefined, mode: 'incremental' | 'full'): number {
  if (raw == null || raw.trim() === '' || raw === '0' || raw.toLowerCase() === 'all') {
    return mode === 'incremental' ? 3 : Number.POSITIVE_INFINITY
  }
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 1) {
    throw new Error(`Invalid COLLABO_MAX_PAGES: ${raw}`)
  }
  return Math.floor(n)
}

function mergeById(existing: NewsItem[], newer: NewsItem[]): NewsItem[] {
  const map = new Map<string, NewsItem>()
  for (const item of existing) map.set(item.id, item)
  for (const item of newer) map.set(item.id, item)
  return [...map.values()].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
}

async function loadExisting(): Promise<NewsItem[]> {
  try {
    const raw = JSON.parse(await readFile(outPath, 'utf8')) as Snapshot
    if (!Array.isArray(raw.items)) return []
    for (const item of raw.items) assertNewsItem(item)
    return raw.items
  } catch {
    return []
  }
}

async function main(): Promise<void> {
  const mode = resolveMode(process.env.SCRAPE_MODE)
  const existing = await loadExisting()
  const maxPages = resolveMaxPages(process.env.COLLABO_MAX_PAGES, mode)
  console.log(
    `[info] scrape source=collabo-cafe mode=${mode} existing=${existing.length} maxPages=${Number.isFinite(maxPages) ? maxPages : 'all'}`,
  )

  let items: NewsItem[]
  if (mode === 'incremental' && existing.length > 0) {
    const knownIds = new Set(existing.map((item) => item.id))
    const newer = await scrapeCollaboCafe({ maxPages, knownIds })
    items = mergeById(existing, newer)
    console.log(`[info] incremental fetched=${newer.length} merged=${items.length}`)
  } else {
    if (mode === 'incremental' && existing.length === 0) {
      console.log('[info] no existing snapshot; falling back to full scrape')
    }
    items = await scrapeCollaboCafe({ maxPages })
  }

  for (const item of items) assertNewsItem(item)

  const payload = {
    sourceId: 'collabo-cafe',
    scrapedAt: new Date().toISOString(),
    mode,
    maxPages: Number.isFinite(maxPages) ? maxPages : null,
    count: items.length,
    items,
  }

  await mkdir(dirname(outPath), { recursive: true })
  await writeFile(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')

  const byCategory = new Map<string, number>()
  let withEventDates = 0
  for (const item of items) {
    if (item.eventDates?.length) withEventDates += 1
    for (const category of item.categories) {
      byCategory.set(category, (byCategory.get(category) ?? 0) + 1)
    }
  }

  console.log(`[info] scrape done items=${items.length} withEventDates=${withEventDates}`)
  console.log(`[info] categories ${JSON.stringify(Object.fromEntries(byCategory))}`)
  console.log(`[info] wrote ${outPath}`)
}

main().catch((error: unknown) => {
  console.error('[error]', error)
  process.exitCode = 1
})
