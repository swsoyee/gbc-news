import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { findDuplicateCandidates } from '../src/feeds/dedupe-candidates.js'
import { applyManualDrops, loadManualDedupeFile } from '../src/feeds/manual-dedupe.js'
import { loadEnrichmentFiles } from '../src/enrichments/files.js'
import { applyEnrichments } from '../src/models/enrichment.js'
import { assertNewsItem, type NewsItem } from '../src/models/item.js'
import { SOURCE_IDS, sourceLatestRelPath } from '../src/models/source.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

interface CliOptions {
  json: boolean
  onlyTitleSimilar: boolean
  limit: number
}

function parseArgs(args: string[]): CliOptions {
  let json = false
  let onlyTitleSimilar = false
  let limit = Number.POSITIVE_INFINITY
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]
    if (arg === '--json') json = true
    else if (arg === '--title-similar') onlyTitleSimilar = true
    else if (arg === '--limit') {
      const value = Number(args[++i])
      if (!Number.isInteger(value) || value <= 0)
        throw new Error('--limit must be a positive integer')
      limit = value
    } else throw new Error(`Unknown argument: ${String(arg)}`)
  }
  return { json, onlyTitleSimilar, limit }
}

async function loadItems(sourceId: (typeof SOURCE_IDS)[number]): Promise<NewsItem[]> {
  const path = join(root, sourceLatestRelPath(sourceId))
  const parsed = JSON.parse(await readFile(path, 'utf8')) as { items?: unknown }
  if (!Array.isArray(parsed.items)) throw new Error(`${path} items must be an array`)
  for (const item of parsed.items) assertNewsItem(item)
  return parsed.items
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))
  const [files, itemGroups, manualDedupe] = await Promise.all([
    loadEnrichmentFiles(root),
    Promise.all([...SOURCE_IDS].map(loadItems)),
    loadManualDedupeFile(root),
  ])

  const enriched = applyEnrichments(itemGroups.flat(), files)
  // 已人工确认剔除的条目不再作为候选
  const { items: remaining } = applyManualDrops(enriched, manualDedupe)

  let candidates = findDuplicateCandidates(remaining)
  if (options.onlyTitleSimilar) candidates = candidates.filter((c) => c.titleSimilar)
  candidates = candidates.slice(0, options.limit)

  if (options.json) {
    console.log(JSON.stringify(candidates, null, 2))
    return
  }
  if (candidates.length === 0) {
    console.log('[info] no cross-source duplicate candidates')
    return
  }
  for (const c of candidates) {
    console.log(
      `${c.titleSimilar ? '★' : ' '} gap=${c.publishedDayGap}d overlap=${c.overlapDates.join(',')}\n` +
        `  KEEP ${c.keepSourceId}/${c.keepId} (${c.keepPublishedAt.slice(0, 10)})  ${c.keepTitle}\n` +
        `  DROP ${c.dropSourceId}/${c.dropId} (${c.dropPublishedAt.slice(0, 10)})  ${c.dropTitle}\n`,
    )
  }
  console.log(`[info] candidates shown=${candidates.length} (★ = 标题相近)`)
}

main().catch((error: unknown) => {
  console.error('[error]', error)
  process.exitCode = 1
})
