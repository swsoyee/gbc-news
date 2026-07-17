import { readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseBackfillArgs, withBackfilledBody } from './lib/backfill-body-text.js'
import { assertNewsItem, type NewsItem } from '../src/models/item.js'
import type { SourceId } from '../src/models/source.js'
import { fetchText } from '../src/utils/http.js'
import { parseNewsDetail as parseGbcDetail } from '../src/scrapers/gbc-news/parse-detail.js'
import { parseNewsDetail as parseFirstriffDetail } from '../src/scrapers/gbc-firstriff/parse.js'
import { parseNewsDetail as parseCollaboDetail } from '../src/scrapers/collabo-cafe/parse-detail.js'
import { parseNewsDetail as parseGamepediaDetail } from '../src/scrapers/gamepedia/parse-detail.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const parseBody: Record<SourceId, (html: string) => string> = {
  'gbc-news': (html) => parseGbcDetail(html).bodyText,
  'gbc-firstriff': (html) => parseFirstriffDetail(html).bodyText,
  'collabo-cafe': (html) => parseCollaboDetail(html).bodyText,
  gamepedia: (html) => parseGamepediaDetail(html).bodyText,
}

interface SnapshotDocument {
  sourceId: string
  items: NewsItem[]
  [key: string]: unknown
}

function assertSnapshot(value: unknown, sourceId: SourceId): asserts value is SnapshotDocument {
  if (!value || typeof value !== 'object') throw new Error('Snapshot must be an object')
  const snapshot = value as Record<string, unknown>
  if (snapshot.sourceId !== sourceId) {
    throw new Error(`Snapshot source mismatch: expected ${sourceId}`)
  }
  if (!Array.isArray(snapshot.items)) throw new Error('Snapshot.items must be an array')
  for (const item of snapshot.items) assertNewsItem(item)
}

async function writeSnapshotAtomic(path: string, snapshot: SnapshotDocument): Promise<void> {
  const temporaryPath = `${path}.tmp-${process.pid}-${Date.now()}`
  try {
    await writeFile(temporaryPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8')
    const verified: unknown = JSON.parse(await readFile(temporaryPath, 'utf8'))
    assertSnapshot(verified, snapshot.sourceId as SourceId)
    await rename(temporaryPath, path)
  } catch (error) {
    await rm(temporaryPath, { force: true })
    throw error
  }
}

async function backfillSource(
  sourceId: SourceId,
  options: { force: boolean; delayMs: number },
): Promise<{ updated: number; skipped: number; failed: string[] }> {
  const path = join(root, 'data', sourceId, 'latest.json')
  const snapshot: unknown = JSON.parse(await readFile(path, 'utf8'))
  assertSnapshot(snapshot, sourceId)

  let updated = 0
  let skipped = 0
  const failed: string[] = []
  const items = [...snapshot.items]
  for (const [index, item] of items.entries()) {
    if (!options.force && item.bodyText) {
      skipped += 1
      continue
    }
    try {
      const html = await fetchText(item.url)
      items[index] = withBackfilledBody(item, parseBody[sourceId](html))
      updated += 1
    } catch (error) {
      failed.push(item.id)
      console.warn(
        `[warn] backfill source=${sourceId} id=${item.id} error=${error instanceof Error ? error.message : String(error)}`,
      )
    }
    const processed = updated + skipped + failed.length
    if (processed % 25 === 0 || processed === items.length) {
      console.log(`[info] backfill source=${sourceId} progress=${processed}/${items.length}`)
    }
    if (options.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, options.delayMs))
    }
  }

  if (updated > 0) {
    await writeSnapshotAtomic(path, { ...snapshot, items, count: items.length })
  }
  console.log(
    `[info] backfill done source=${sourceId} updated=${updated} skipped=${skipped} failed=${failed.length}`,
  )
  if (failed.length > 0) console.warn(`[warn] retry source=${sourceId} ids=${failed.join(',')}`)
  return { updated, skipped, failed }
}

async function main(): Promise<void> {
  const options = parseBackfillArgs(process.argv.slice(2))
  let updated = 0
  let skipped = 0
  let failed = 0
  for (const sourceId of options.sources) {
    const result = await backfillSource(sourceId, options)
    updated += result.updated
    skipped += result.skipped
    failed += result.failed.length
  }
  console.log(`[info] backfill summary updated=${updated} skipped=${skipped} failed=${failed}`)
}

main().catch((error: unknown) => {
  console.error('[error]', error)
  process.exitCode = 1
})
