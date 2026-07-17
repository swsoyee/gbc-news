import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEnrichmentFiles } from '../src/enrichments/files.js'
import { listPendingItems, parsePendingCliArgs } from '../src/enrichments/pending.js'
import { assertNewsItem, type NewsItem } from '../src/models/item.js'
import { SOURCE_IDS } from '../src/models/source.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

async function loadItems(sourceId: string): Promise<NewsItem[]> {
  const path = join(root, 'data', sourceId, 'latest.json')
  const parsed = JSON.parse(await readFile(path, 'utf8')) as { items?: unknown }
  if (!Array.isArray(parsed.items)) throw new Error(`${path} items must be an array`)
  for (const item of parsed.items) assertNewsItem(item)
  return parsed.items
}

async function main(): Promise<void> {
  const options = parsePendingCliArgs(process.argv.slice(2))
  const sourceIds = options.source ? [options.source] : [...SOURCE_IDS]
  const [files, itemGroups] = await Promise.all([
    loadEnrichmentFiles(root, sourceIds),
    Promise.all(sourceIds.map(loadItems)),
  ])
  const pending = listPendingItems(itemGroups.flat(), files).slice(0, options.limit)
  const output = pending.map(
    ({ priority, reason, contentFingerprint: fingerprint, item, previous }) => ({
      priority: `P${priority}`,
      reason,
      contentFingerprint: fingerprint,
      id: item.id,
      sourceId: item.sourceId,
      title: item.title,
      url: item.url,
      publishedAt: item.publishedAt,
      categories: item.categories,
      groups: item.groups,
      eventDates: item.eventDates ?? [],
      bodyText: item.bodyText ?? '',
      ...(previous ? { previous } : {}),
    }),
  )

  if (options.json) {
    console.log(JSON.stringify(output, null, 2))
    return
  }
  if (output.length === 0) {
    console.log('[info] no pending enrichments')
    return
  }
  for (const entry of output) {
    console.log(
      `${entry.priority} ${entry.sourceId}/${entry.id} ${entry.reason}\n${entry.title}\n${entry.url}\nfingerprint=${entry.contentFingerprint}\neventDates=${JSON.stringify(entry.eventDates)}\nbodyText=${entry.bodyText}\n`,
    )
  }
  console.log(`[info] pending shown=${output.length} limit=${options.limit}`)
}

main().catch((error: unknown) => {
  console.error('[error]', error)
  process.exitCode = 1
})
