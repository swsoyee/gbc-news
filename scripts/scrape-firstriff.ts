import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertNewsItem } from '../src/models/item.js'
import { scrapeFirstriff } from '../src/scrapers/gbc-firstriff/index.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outPath = join(root, 'data/gbc-firstriff/latest.json')

async function main(): Promise<void> {
  const maxPages = Number(process.env.FIRSTRIFF_MAX_PAGES ?? 1)
  console.log(`[info] scrape source=gbc-firstriff maxPages=${maxPages}`)

  const items = await scrapeFirstriff({ maxPages })
  for (const item of items) assertNewsItem(item)

  const payload = {
    sourceId: 'gbc-firstriff',
    scrapedAt: new Date().toISOString(),
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
