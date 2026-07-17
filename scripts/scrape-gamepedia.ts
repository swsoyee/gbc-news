import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { scrapeGamepedia } from '../src/scrapers/gamepedia/index.js'
import {
  countByField,
  loadSnapshotItems,
  mergeById,
  resolveMaxPages,
  resolveScrapeMode,
  writeSnapshot,
} from './lib/scrape-snapshot.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outPath = join(root, 'data/gamepedia/latest.json')

async function main(): Promise<void> {
  const mode = resolveScrapeMode(process.env.SCRAPE_MODE)
  const existing = await loadSnapshotItems(outPath)
  const maxPages = resolveMaxPages(process.env.GAMEPEDIA_MAX_PAGES, {
    envName: 'GAMEPEDIA_MAX_PAGES',
    emptyDefault: mode === 'incremental' ? 3 : Number.POSITIVE_INFINITY,
  })
  console.log(
    `[info] scrape source=gamepedia mode=${mode} existing=${existing.length} maxPages=${Number.isFinite(maxPages) ? maxPages : 'all'}`,
  )

  let items
  if (mode === 'incremental' && existing.length > 0) {
    const knownIds = new Set(existing.map((item) => item.id))
    const newer = await scrapeGamepedia({ maxPages, knownIds })
    items = mergeById(existing, newer)
    console.log(`[info] incremental fetched=${newer.length} merged=${items.length}`)
  } else {
    if (mode === 'incremental' && existing.length === 0) {
      console.log('[info] no existing snapshot; falling back to full scrape')
    }
    items = await scrapeGamepedia({ maxPages })
  }

  await writeSnapshot(outPath, {
    sourceId: 'gamepedia',
    scrapedAt: new Date().toISOString(),
    mode,
    maxPages: Number.isFinite(maxPages) ? maxPages : null,
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
