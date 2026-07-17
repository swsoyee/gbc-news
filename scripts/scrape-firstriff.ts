import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { scrapeFirstriff } from '../src/scrapers/gbc-firstriff/index.js'
import {
  countByField,
  loadSnapshotItems,
  mergeById,
  resolveScrapeMode,
  writeSnapshot,
} from './lib/scrape-snapshot.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outPath = join(root, 'data/gbc-firstriff/latest.json')

async function main(): Promise<void> {
  const mode = resolveScrapeMode(process.env.SCRAPE_MODE)
  const existing = await loadSnapshotItems(outPath)
  const maxPages = Number(process.env.FIRSTRIFF_MAX_PAGES ?? (mode === 'incremental' ? 3 : 1))
  console.log(
    `[info] scrape source=gbc-firstriff mode=${mode} existing=${existing.length} maxPages=${maxPages}`,
  )

  let items
  if (mode === 'incremental' && existing.length > 0) {
    const knownIds = new Set(existing.map((item) => item.id))
    const newer = await scrapeFirstriff({ maxPages, knownIds })
    items = mergeById(existing, newer)
    console.log(`[info] incremental fetched=${newer.length} merged=${items.length}`)
  } else {
    items = await scrapeFirstriff({ maxPages })
  }

  await writeSnapshot(outPath, {
    sourceId: 'gbc-firstriff',
    scrapedAt: new Date().toISOString(),
    mode,
    maxPages,
    count: items.length,
    items,
  })

  console.log(`[info] scrape done items=${items.length}`)
  console.log(`[info] groups ${JSON.stringify(countByField(items, 'groups'))}`)
  console.log(`[info] wrote ${outPath}`)
}

main().catch((error: unknown) => {
  console.error('[error]', error)
  process.exitCode = 1
})
