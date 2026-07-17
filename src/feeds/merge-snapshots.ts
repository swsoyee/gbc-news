import { assertNewsItem, type NewsItem } from '../models/item.js'
import { expandEventDates, type FeedEntry } from './expand.js'

export interface SnapshotLike {
  items?: unknown
  sourceId?: string
}

export interface MergeSourceInput {
  label: string
  snapshot: SnapshotLike | null
}

export interface MergeResult {
  merged: NewsItem[]
  sources: string[]
  warnings: string[]
}

/** 合并多源快照：缺源/空 items 跳过并记警告，不抛错。 */
export function mergeNewsSnapshots(inputs: MergeSourceInput[]): MergeResult {
  const merged: NewsItem[] = []
  const sources: string[] = []
  const warnings: string[] = []

  for (const { label, snapshot } of inputs) {
    if (snapshot == null) {
      warnings.push(`${label} 不存在，跳过该源`)
      continue
    }
    if (!Array.isArray(snapshot.items) || snapshot.items.length === 0) {
      warnings.push(`${label} 无有效 items，跳过`)
      continue
    }
    for (const item of snapshot.items) assertNewsItem(item)
    merged.push(...(snapshot.items as NewsItem[]))
    sources.push(typeof snapshot.sourceId === 'string' ? snapshot.sourceId : label)
  }

  merged.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
  return { merged, sources, warnings }
}

export function requireNonEmptyMergedItems(merged: NewsItem[]): void {
  if (merged.length === 0) {
    throw new Error('无可用资讯快照，拒绝生成空订阅（请先 scrape）')
  }
}

/** 展开活动日；全量为空则拒绝写出空订阅。 */
export function requireExpandableEntries(merged: NewsItem[]): FeedEntry[] {
  const entries = expandEventDates(merged)
  if (entries.length === 0) {
    throw new Error('展开后无活动日期条目，拒绝写出空 RSS/iCal')
  }
  return entries
}
