import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildIcal, buildRss } from '../src/feeds/build.js'
import { applyManualDrops, loadManualDedupeFile } from '../src/feeds/manual-dedupe.js'
import {
  mergeNewsSnapshots,
  requireExpandableEntries,
  requireNonEmptyMergedItems,
  type SnapshotLike,
} from '../src/feeds/merge-snapshots.js'
import { CATEGORY_IDS, CATEGORY_LABELS, type CategoryId } from '../src/models/categories.js'
import { GROUP_IDS, GROUP_LABELS } from '../src/models/groups.js'
import { filterItems } from '../src/models/item.js'
import { expandEventDates } from '../src/feeds/expand.js'
import { loadEnrichmentFiles } from '../src/enrichments/files.js'
import { applyEnrichments } from '../src/models/enrichment.js'
import { EVENT_DATE_TITLE_PREFIX_ZH } from '../src/models/event-date.js'
import { SOURCE_IDS, sourceLatestRelPath } from '../src/models/source.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const publicDataPath = join(root, 'public/data/news.json')
const feedsDir = join(root, 'public/feeds')

async function main(): Promise<void> {
  const inputs = await Promise.all(
    SOURCE_IDS.map(async (sourceId) => {
      const dataPath = join(root, sourceLatestRelPath(sourceId))
      try {
        const rawText = await readFile(dataPath, 'utf8')
        return { label: dataPath, snapshot: JSON.parse(rawText) as SnapshotLike }
      } catch {
        return { label: dataPath, snapshot: null }
      }
    }),
  )

  const { merged, sources, warnings } = mergeNewsSnapshots(inputs)
  for (const warning of warnings) console.warn(`[warn] ${warning}`)

  requireNonEmptyMergedItems(merged)
  const enrichmentFiles = await loadEnrichmentFiles(root)
  const enriched = applyEnrichments(merged, enrichmentFiles)
  const manualDedupe = await loadManualDedupeFile(root)
  const {
    items: publicItems,
    dropped,
    warnings: dedupeWarnings,
  } = applyManualDrops(enriched, manualDedupe)
  for (const warning of dedupeWarnings) console.warn(`[warn] ${warning}`)
  for (const drop of dropped) {
    console.log(
      `[info] manual dedupe drop id=${drop.id} kept=${drop.keptId ?? '-'} reason=${drop.reason ?? '-'}`,
    )
  }

  const siteUrl = process.env.SITE_URL ?? 'https://gbc-news.example.com'
  await mkdir(dirname(publicDataPath), { recursive: true })
  await mkdir(feedsDir, { recursive: true })

  const snapshot = {
    scrapedAt: new Date().toISOString(),
    sources,
    count: publicItems.length,
    items: publicItems,
  }
  await writeFile(publicDataPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8')

  const expandOptions = { titlePrefixes: EVENT_DATE_TITLE_PREFIX_ZH }
  const allEntries = requireExpandableEntries(publicItems, expandOptions)

  await writeRss('all', allEntries, siteUrl)
  await writeIcs('all', allEntries, siteUrl)

  for (const category of CATEGORY_IDS) {
    const filtered = filterItems(publicItems, { categories: [category] })
    const entries = expandEventDates(filtered, expandOptions)
    await writeRss(category, entries, siteUrl)
    await writeIcs(category, entries, siteUrl)
  }

  for (const group of GROUP_IDS) {
    const filtered = filterItems(publicItems, { groups: [group] })
    const entries = expandEventDates(filtered, expandOptions)
    await writeRss(`group-${group}`, entries, siteUrl, GROUP_LABELS[group].zh)
    await writeIcs(`group-${group}`, entries, siteUrl, GROUP_LABELS[group].zh)
  }

  console.log(
    `[info] build-feeds done items=${publicItems.length} feedEntries=${allEntries.length} sources=${sources.join(',')} manualDrops=${dropped.length}`,
  )
}

async function writeRss(
  name: string,
  entries: ReturnType<typeof expandEventDates>,
  siteUrl: string,
  labelOverride?: string,
): Promise<void> {
  const label =
    labelOverride ?? (name === 'all' ? '全部' : (CATEGORY_LABELS[name as CategoryId]?.zh ?? name))
  const meta = {
    title: `gbc-news · ${label}`,
    homeUrl: `${siteUrl}/`,
    feedUrl: `${siteUrl}/feeds/${name}.xml`,
    description: `ガールズバンドクライ 公式ニュース（${label}）`,
  }
  await writeFile(join(feedsDir, `${name}.xml`), buildRss(entries, meta), 'utf8')
}

async function writeIcs(
  name: string,
  entries: ReturnType<typeof expandEventDates>,
  siteUrl: string,
  labelOverride?: string,
): Promise<void> {
  const label =
    labelOverride ?? (name === 'all' ? '全部' : (CATEGORY_LABELS[name as CategoryId]?.zh ?? name))
  const meta = {
    title: `gbc-news · ${label}`,
    homeUrl: `${siteUrl}/`,
    feedUrl: `${siteUrl}/feeds/${name}.ics`,
    description: `ガールズバンドクライ イベント（${label}）`,
  }
  await writeFile(join(feedsDir, `${name}.ics`), buildIcal(entries, meta), 'utf8')
}

main().catch((error: unknown) => {
  console.error('[error]', error)
  process.exitCode = 1
})
