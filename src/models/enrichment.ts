import { createHash } from 'node:crypto'
import { assertEventDate, type EventDate } from './event-date.js'
import type { NewsItem } from './item.js'

export const ENRICHMENT_STATUSES = ['pending', 'reviewed', 'skip'] as const
export type EnrichmentStatus = (typeof ENRICHMENT_STATUSES)[number]

export interface EnrichmentRecord {
  id: string
  sourceId: string
  status: EnrichmentStatus
  contentFingerprint: string
  reviewedAt?: string
  titleZh?: string
  summaryZh?: string
  eventDates?: EventDate[]
  reviewNotes?: string
}

export interface EnrichmentFile {
  sourceId: string
  updatedAt: string
  items: Record<string, EnrichmentRecord>
}

/** 发布到 news.json 的增强视图；bodyText 永不进入该类型。 */
export type PublicNewsItem = Omit<NewsItem, 'bodyText'> & {
  titleZh?: string
  summaryZh?: string
}

function isIsoTimestamp(value: string): boolean {
  return !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value
}

function assertOptionalString(
  record: Record<string, unknown>,
  key: 'reviewedAt' | 'titleZh' | 'summaryZh' | 'reviewNotes',
): void {
  const value = record[key]
  if (value !== undefined && (typeof value !== 'string' || value.length === 0)) {
    throw new Error(`EnrichmentRecord.${key} must be a non-empty string when set`)
  }
}

export function assertEnrichmentRecord(
  value: unknown,
  expected?: { id?: string; sourceId?: string },
): asserts value is EnrichmentRecord {
  if (!value || typeof value !== 'object') {
    throw new Error('EnrichmentRecord must be an object')
  }
  const record = value as Record<string, unknown>
  for (const key of ['id', 'sourceId', 'contentFingerprint'] as const) {
    if (typeof record[key] !== 'string' || record[key].length === 0) {
      throw new Error(`EnrichmentRecord.${key} must be a non-empty string`)
    }
  }
  if (
    typeof record.status !== 'string' ||
    !(ENRICHMENT_STATUSES as readonly string[]).includes(record.status)
  ) {
    throw new Error('EnrichmentRecord.status must be pending|reviewed|skip')
  }
  if (!/^[a-f0-9]{64}$/.test(record.contentFingerprint as string)) {
    throw new Error('EnrichmentRecord.contentFingerprint must be a SHA-256 hex digest')
  }
  for (const key of ['reviewedAt', 'titleZh', 'summaryZh', 'reviewNotes'] as const) {
    assertOptionalString(record, key)
  }
  if (record.reviewedAt !== undefined && !isIsoTimestamp(record.reviewedAt as string)) {
    throw new Error('EnrichmentRecord.reviewedAt must be an ISO timestamp')
  }
  if (record.eventDates !== undefined) {
    if (!Array.isArray(record.eventDates)) {
      throw new Error('EnrichmentRecord.eventDates must be an array when set')
    }
    for (const eventDate of record.eventDates) assertEventDate(eventDate)
  }
  if (record.status === 'reviewed') {
    for (const key of ['reviewedAt', 'titleZh', 'summaryZh'] as const) {
      if (typeof record[key] !== 'string' || record[key].length === 0) {
        throw new Error(`Reviewed enrichment requires ${key}`)
      }
    }
  }
  if (record.status === 'skip' && record.reviewedAt === undefined) {
    throw new Error('Skipped enrichment requires reviewedAt')
  }
  if (expected?.id !== undefined && record.id !== expected.id) {
    throw new Error(`Enrichment key/id mismatch: ${expected.id} != ${String(record.id)}`)
  }
  if (expected?.sourceId !== undefined && record.sourceId !== expected.sourceId) {
    throw new Error(
      `Enrichment source mismatch: ${expected.sourceId} != ${String(record.sourceId)}`,
    )
  }
}

export function assertEnrichmentFile(value: unknown): asserts value is EnrichmentFile {
  if (!value || typeof value !== 'object') throw new Error('EnrichmentFile must be an object')
  const file = value as Record<string, unknown>
  if (typeof file.sourceId !== 'string' || file.sourceId.length === 0) {
    throw new Error('EnrichmentFile.sourceId must be a non-empty string')
  }
  if (
    typeof file.updatedAt !== 'string' ||
    file.updatedAt.length === 0 ||
    !isIsoTimestamp(file.updatedAt)
  ) {
    throw new Error('EnrichmentFile.updatedAt must be an ISO timestamp')
  }
  if (!file.items || typeof file.items !== 'object' || Array.isArray(file.items)) {
    throw new Error('EnrichmentFile.items must be an object')
  }
  for (const [id, record] of Object.entries(file.items as Record<string, unknown>)) {
    assertEnrichmentRecord(record, { id, sourceId: file.sourceId })
  }
}

function normalizeFingerprintPart(value: string | undefined): string {
  return (value ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim()
}

export function contentFingerprint(item: Pick<NewsItem, 'title' | 'bodyText'>): string {
  const content = `${normalizeFingerprintPart(item.title)}\n${normalizeFingerprintPart(item.bodyText)}`
  return createHash('sha256').update(content, 'utf8').digest('hex')
}

export function applyEnrichments(
  items: NewsItem[],
  files: ReadonlyMap<string, EnrichmentFile>,
): PublicNewsItem[] {
  return items.map((item) => {
    const { bodyText: _bodyText, ...publicItem } = item
    const record = files.get(item.sourceId)?.items[item.id]
    if (record?.status !== 'reviewed' || record.contentFingerprint !== contentFingerprint(item)) {
      return publicItem
    }
    return {
      ...publicItem,
      titleZh: record.titleZh!,
      summaryZh: record.summaryZh!,
      ...(record.eventDates !== undefined ? { eventDates: record.eventDates } : {}),
    }
  })
}
