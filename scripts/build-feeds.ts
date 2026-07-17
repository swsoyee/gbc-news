import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildIcal, buildRss } from '../src/feeds/build.js'
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

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const sourcePaths = [
  join(root, 'data/gbc-news/latest.json'),
  join(root, 'data/gbc-firstriff/latest.json'),
  join(root, 'data/collabo-cafe/latest.json'),
]
const publicDataPath = join(root, 'public/data/news.json')
const feedsDir = join(root, 'public/feeds')

async function main(): Promise<void> {
  const inputs = await Promise.all(
    sourcePaths.map(async (dataPath) => {
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

  const siteUrl = process.env.SITE_URL ?? 'https://gbc-news.example.com'
  await mkdir(dirname(publicDataPath), { recursive: true })
  await mkdir(feedsDir, { recursive: true })

  const snapshot = {
    scrapedAt: new Date().toISOString(),
    sources,
    count: merged.length,
    items: merged,
  }
  await writeFile(publicDataPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8')

  const allEntries = requireExpandableEntries(merged)

  await writeRss('all', allEntries, siteUrl)
  await writeIcs('all', allEntries, siteUrl)

  for (const category of CATEGORY_IDS) {
    const filtered = filterItems(merged, { categories: [category] })
    const entries = expandEventDates(filtered)
    await writeRss(category, entries, siteUrl)
    await writeIcs(category, entries, siteUrl)
  }

  for (const group of GROUP_IDS) {
    const filtered = filterItems(merged, { groups: [group] })
    const entries = expandEventDates(filtered)
    await writeRss(`group-${group}`, entries, siteUrl, GROUP_LABELS[group].zh)
    await writeIcs(`group-${group}`, entries, siteUrl, GROUP_LABELS[group].zh)
  }

  console.log(
    `[info] build-feeds done items=${merged.length} feedEntries=${allEntries.length} sources=${sources.join(',')}`,
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
