import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertNewsItem } from '../src/models/item.js'
import { scrapeGbcNews } from '../src/scrapers/gbc-news/index.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outPath = join(root, 'data/gbc-news/latest.json')

function resolveMaxPages(raw: string | undefined): number {
  if (raw == null || raw.trim() === '' || raw === '0' || raw.toLowerCase() === 'all') {
    return Number.POSITIVE_INFINITY
  }
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 1) {
    throw new Error(`Invalid GBC_MAX_PAGES: ${raw}`)
  }
  return Math.floor(n)
}

async function main(): Promise<void> {
  const maxPages = resolveMaxPages(process.env.GBC_MAX_PAGES)
  console.log(
    `[info] scrape source=gbc-news maxPages=${Number.isFinite(maxPages) ? maxPages : 'all'}`,
  )

  const items = await scrapeGbcNews({ maxPages })
  for (const item of items) assertNewsItem(item)

  const payload = {
    sourceId: 'gbc-news',
    scrapedAt: new Date().toISOString(),
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
