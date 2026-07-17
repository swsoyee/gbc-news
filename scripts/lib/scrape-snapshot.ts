import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { assertNewsItem, type NewsItem } from '../../src/models/item.js'

export type ScrapeMode = 'incremental' | 'full'

export interface SnapshotPayload {
  sourceId: string
  scrapedAt: string
  mode: ScrapeMode
  maxPages: number | null
  count: number
  items: NewsItem[]
}

export function resolveScrapeMode(raw: string | undefined): ScrapeMode {
  const mode = (raw ?? 'incremental').toLowerCase()
  if (mode === 'full') return 'full'
  if (mode === 'incremental' || mode === 'incr') return 'incremental'
  throw new Error(`Invalid SCRAPE_MODE: ${raw}`)
}

export function resolveMaxPages(
  raw: string | undefined,
  options: { envName: string; emptyDefault: number },
): number {
  if (raw == null || raw.trim() === '' || raw === '0' || raw.toLowerCase() === 'all') {
    return options.emptyDefault
  }
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 1) {
    throw new Error(`Invalid ${options.envName}: ${raw}`)
  }
  return Math.floor(n)
}

export function mergeById(existing: NewsItem[], newer: NewsItem[]): NewsItem[] {
  const map = new Map<string, NewsItem>()
  for (const item of existing) map.set(item.id, item)
  for (const item of newer) map.set(item.id, item)
  return [...map.values()].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
}

export async function loadSnapshotItems(path: string): Promise<NewsItem[]> {
  try {
    const raw = JSON.parse(await readFile(path, 'utf8')) as { items?: NewsItem[] }
    if (!Array.isArray(raw.items)) return []
    for (const item of raw.items) assertNewsItem(item)
    return raw.items
  } catch {
    return []
  }
}

export async function writeSnapshot(path: string, payload: SnapshotPayload): Promise<void> {
  for (const item of payload.items) assertNewsItem(item)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
}

export function countByField(
  items: NewsItem[],
  field: 'categories' | 'groups',
): Record<string, number> {
  const counts = new Map<string, number>()
  for (const item of items) {
    for (const value of item[field]) {
      counts.set(value, (counts.get(value) ?? 0) + 1)
    }
  }
  return Object.fromEntries(counts)
}
