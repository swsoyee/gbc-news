import { hasEventCue } from '../categories/extract-event-dates.js'
import {
  contentFingerprint,
  type EnrichmentFile,
  type EnrichmentRecord,
} from '../models/enrichment.js'
import type { NewsItem } from '../models/item.js'
import { isSourceId, type SourceId } from '../models/source.js'

export type PendingPriority = 0 | 1 | 2 | 3

export interface PendingItem {
  priority: PendingPriority
  reason: 'stale' | 'has-event-dates' | 'likely-event' | 'unreviewed'
  contentFingerprint: string
  item: NewsItem
  previous?: EnrichmentRecord
}

export interface PendingCliOptions {
  source?: SourceId
  limit: number
  json: boolean
}

function pendingPriority(
  item: NewsItem,
  record: EnrichmentRecord | undefined,
  fingerprint: string,
): Pick<PendingItem, 'priority' | 'reason'> | null {
  if (record && record.status !== 'pending' && record.contentFingerprint !== fingerprint) {
    return { priority: 0, reason: 'stale' }
  }
  if (record && record.status !== 'pending') return null
  if (item.eventDates && item.eventDates.length > 0) {
    return { priority: 1, reason: 'has-event-dates' }
  }
  if (
    item.categories.some((category) => category === 'live' || category === 'event') ||
    hasEventCue(item.title, item.bodyText)
  ) {
    return { priority: 2, reason: 'likely-event' }
  }
  return { priority: 3, reason: 'unreviewed' }
}

export function listPendingItems(
  items: NewsItem[],
  files: ReadonlyMap<string, EnrichmentFile>,
): PendingItem[] {
  const pending: PendingItem[] = []
  for (const item of items) {
    const record = files.get(item.sourceId)?.items[item.id]
    const fingerprint = contentFingerprint(item)
    const classification = pendingPriority(item, record, fingerprint)
    if (!classification) continue
    pending.push({
      ...classification,
      contentFingerprint: fingerprint,
      item,
      ...(record ? { previous: record } : {}),
    })
  }
  return pending.sort(
    (a, b) =>
      a.priority - b.priority ||
      b.item.publishedAt.localeCompare(a.item.publishedAt) ||
      a.item.sourceId.localeCompare(b.item.sourceId) ||
      a.item.id.localeCompare(b.item.id),
  )
}

export function parsePendingCliArgs(args: string[]): PendingCliOptions {
  let source: SourceId | undefined
  let limit = 20
  let json = false
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--json') {
      json = true
      continue
    }
    if (arg === '--source') {
      const value = args[++index]
      if (!value || !isSourceId(value)) throw new Error(`Invalid --source: ${String(value)}`)
      source = value
      continue
    }
    if (arg === '--limit') {
      const value = Number(args[++index])
      if (!Number.isInteger(value) || value < 1) {
        throw new Error('--limit must be a positive integer')
      }
      limit = value
      continue
    }
    throw new Error(`Unknown argument: ${String(arg)}`)
  }
  return { ...(source ? { source } : {}), limit, json }
}
