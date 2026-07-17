import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEnrichmentFiles } from '../src/enrichments/files.js'
import { loadManualDedupeFile, validateManualDedupeReferences } from '../src/feeds/manual-dedupe.js'
import { assertNewsItem, type NewsItem } from '../src/models/item.js'
import { SOURCE_IDS, sourceLatestRelPath } from '../src/models/source.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

async function loadAllItems(): Promise<NewsItem[]> {
  const groups = await Promise.all(
    SOURCE_IDS.map(async (sourceId) => {
      const path = join(root, sourceLatestRelPath(sourceId))
      const parsed = JSON.parse(await readFile(path, 'utf8')) as { items?: unknown }
      if (!Array.isArray(parsed.items)) throw new Error(`${path} items must be an array`)
      for (const item of parsed.items) assertNewsItem(item)
      return parsed.items
    }),
  )
  return groups.flat()
}

async function main(): Promise<void> {
  const [files, items, manualDedupe] = await Promise.all([
    loadEnrichmentFiles(root),
    loadAllItems(),
    loadManualDedupeFile(root),
  ])

  const records = [...files.values()].reduce((sum, file) => sum + Object.keys(file.items).length, 0)
  console.log(`[info] enrichments valid files=${files.size} records=${records}`)

  const dropIds = new Set(manualDedupe.drops.map((drop) => drop.id))
  let enrichedButDropped = 0
  for (const file of files.values()) {
    for (const id of Object.keys(file.items)) {
      if (dropIds.has(id)) enrichedButDropped += 1
    }
  }
  if (enrichedButDropped > 0) {
    console.log(
      `[info] enrichment records also in manual dedupe drops=${enrichedButDropped} (pending 队列会跳过这些 id；公开 feeds 已剔除)`,
    )
  }

  const { errors, warnings } = validateManualDedupeReferences(manualDedupe, items)
  for (const warning of warnings) console.warn(`[warn] ${warning}`)
  for (const error of errors) console.error(`[error] ${error}`)
  console.log(
    `[info] manual dedupe drops=${manualDedupe.drops.length} refWarnings=${warnings.length} refErrors=${errors.length}`,
  )
  if (errors.length > 0) process.exitCode = 1
}

main().catch((error: unknown) => {
  console.error('[error]', error)
  process.exitCode = 1
})
