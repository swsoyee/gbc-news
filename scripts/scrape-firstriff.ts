import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertNewsItem, type NewsItem } from '../src/models/item.js'
import { scrapeFirstriff } from '../src/scrapers/gbc-firstriff/index.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outPath = join(root, 'data/gbc-firstriff/latest.json')

interface Snapshot {
  items?: NewsItem[]
}

function resolveMode(raw: string | undefined): 'incremental' | 'full' {
  const mode = (raw ?? 'incremental').toLowerCase()
  if (mode === 'full') return 'full'
  if (mode === 'incremental' || mode === 'incr') return 'incremental'
  throw new Error(`Invalid SCRAPE_MODE: ${raw}`)
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
  const maxPages = Number(process.env.FIRSTRIFF_MAX_PAGES ?? (mode === 'incremental' ? 3 : 1))
  console.log(
    `[info] scrape source=gbc-firstriff mode=${mode} existing=${existing.length} maxPages=${maxPages}`,
  )

  let items: NewsItem[]
  if (mode === 'incremental' && existing.length > 0) {
    const knownIds = new Set(existing.map((item) => item.id))
    const newer = await scrapeFirstriff({ maxPages, knownIds })
    items = mergeById(existing, newer)
    console.log(`[info] incremental fetched=${newer.length} merged=${items.length}`)
  } else {
    items = await scrapeFirstriff({ maxPages })
  }

  for (const item of items) assertNewsItem(item)

  const payload = {
    sourceId: 'gbc-firstriff',
    scrapedAt: new Date().toISOString(),
    mode,
    maxPages,
    count: items.length,
    items,
  }

  await mkdir(dirname(outPath), { recursive: true })
  await writeFile(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')

  const byGroup = new Map<string, number>()
  for (const item of items) {
    for (const group of item.groups) {
      byGroup.set(group, (byGroup.get(group) ?? 0) + 1)
    }
  }

  console.log(`[info] scrape done items=${items.length}`)
  console.log(`[info] groups ${JSON.stringify(Object.fromEntries(byGroup))}`)
  console.log(`[info] wrote ${outPath}`)
}

main().catch((error: unknown) => {
  console.error('[error]', error)
  process.exitCode = 1
})
