import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertNewsItem } from '../src/models/item.js'
import { scrapeGbcNews } from '../src/scrapers/gbc-news/index.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outPath = join(root, 'data/gbc-news/latest.json')

async function main(): Promise<void> {
  const maxPages = Number(process.env.GBC_MAX_PAGES ?? 3)
  console.log(`[info] scrape source=gbc-news maxPages=${maxPages}`)

  const items = await scrapeGbcNews({ maxPages })
  for (const item of items) assertNewsItem(item)

  const payload = {
    sourceId: 'gbc-news',
    scrapedAt: new Date().toISOString(),
    maxPages,
    count: items.length,
    items,
  }

  await mkdir(dirname(outPath), { recursive: true })
  await writeFile(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')

  const byCategory = new Map<string, number>()
  for (const item of items) {
    for (const category of item.categories) {
      byCategory.set(category, (byCategory.get(category) ?? 0) + 1)
    }
  }

  console.log(`[info] scrape done items=${items.length}`)
  console.log(`[info] categories ${JSON.stringify(Object.fromEntries(byCategory))}`)
  console.log(`[info] wrote ${outPath}`)
}

main().catch((error: unknown) => {
  console.error('[error]', error)
  process.exitCode = 1
})
