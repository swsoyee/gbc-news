import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { scrapeGbcNews } from '../src/scrapers/gbc-news/index.js'
import {
  countByField,
  loadSnapshotItems,
  mergeById,
  resolveMaxPages,
  resolveScrapeMode,
  writeSnapshot,
} from './lib/scrape-snapshot.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outPath = join(root, 'data/gbc-news/latest.json')

async function main(): Promise<void> {
  const mode = resolveScrapeMode(process.env.SCRAPE_MODE)
  const existing = await loadSnapshotItems(outPath)
  console.log(`[info] scrape source=gbc-news mode=${mode} existing=${existing.length}`)

  let items
  let maxPagesMeta: number | null

  if (mode === 'incremental' && existing.length > 0) {
    const maxPages = resolveMaxPages(process.env.GBC_MAX_PAGES ?? '5', {
      envName: 'GBC_MAX_PAGES',
      emptyDefault: 5,
    })
    const knownIds = new Set(existing.map((item) => item.id))
    const newer = await scrapeGbcNews({ maxPages, knownIds })
    items = mergeById(existing, newer)
    maxPagesMeta = Number.isFinite(maxPages) ? maxPages : null
    console.log(`[info] incremental fetched=${newer.length} merged=${items.length}`)
  } else {
    if (mode === 'incremental' && existing.length === 0) {
      console.log('[info] no existing snapshot; falling back to full scrape')
    }
    const maxPages = resolveMaxPages(process.env.GBC_MAX_PAGES, {
      envName: 'GBC_MAX_PAGES',
      emptyDefault: Number.POSITIVE_INFINITY,
    })
    items = await scrapeGbcNews({ maxPages })
    maxPagesMeta = Number.isFinite(maxPages) ? maxPages : null
  }

  await writeSnapshot(outPath, {
    sourceId: 'gbc-news',
    scrapedAt: new Date().toISOString(),
    mode,
    maxPages: maxPagesMeta,
    count: items.length,
    items,
  })

  const withEventDates = items.filter((item) => item.eventDates?.length).length
  console.log(`[info] scrape done items=${items.length} withEventDates=${withEventDates}`)
  console.log(`[info] categories ${JSON.stringify(countByField(items, 'categories'))}`)
  console.log(`[info] wrote ${outPath}`)
}

main().catch((error: unknown) => {
  console.error('[error]', error)
  process.exitCode = 1
})
