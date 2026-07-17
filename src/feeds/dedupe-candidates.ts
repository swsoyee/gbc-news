import type { EventDate } from '../models/event-date.js'
import type { NewsItem } from '../models/item.js'
import { sourcePriority } from '../models/source.js'

const MS_PER_DAY = 24 * 60 * 60 * 1000

const WORK_NAME_RE = /ガールズバンドクライ|ガルクラ|girls\s*band\s*cry/gi

type NewsItemLike = Pick<NewsItem, 'id' | 'title' | 'publishedAt' | 'sourceId'> & {
  eventDates?: EventDate[]
}

/**
 * 跨源重复候选（仅建议，不自动剔除）。
 * 供人工去重 skill 参考；最终是否剔除由人工写入 data/dedupe/manual.json 决定。
 */
export interface DuplicateCandidate {
  keepId: string
  keepSourceId: string
  keepTitle: string
  keepPublishedAt: string
  dropId: string
  dropSourceId: string
  dropTitle: string
  dropPublishedAt: string
  publishedDayGap: number
  titleSimilar: boolean
  overlapDates: string[]
}

/**
 * 找出跨源、`eventDates` 有重叠的候选对。
 * 不按 publishedAt 硬过滤（早报+近报也应浮现），仅作为排序/提示信号。
 */
export function findDuplicateCandidates(items: readonly NewsItemLike[]): DuplicateCandidate[] {
  const candidates: DuplicateCandidate[] = []

  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      const a = items[i]!
      const b = items[j]!
      if (a.sourceId === b.sourceId) continue
      const overlap = overlappingRanges(a.eventDates, b.eventDates)
      if (overlap.length === 0) continue

      const [keep, drop] =
        sourcePriority(a.sourceId) <= sourcePriority(b.sourceId) ? [a, b] : [b, a]

      candidates.push({
        keepId: keep.id,
        keepSourceId: keep.sourceId,
        keepTitle: keep.title,
        keepPublishedAt: keep.publishedAt,
        dropId: drop.id,
        dropSourceId: drop.sourceId,
        dropTitle: drop.title,
        dropPublishedAt: drop.publishedAt,
        publishedDayGap: dayGap(a.publishedAt, b.publishedAt),
        titleSimilar: titlesSimilar(a.title, b.title),
        overlapDates: overlap,
      })
    }
  }

  candidates.sort((a, b) => {
    if (a.titleSimilar !== b.titleSimilar) return a.titleSimilar ? -1 : 1
    return a.publishedDayGap - b.publishedDayGap
  })
  return candidates
}

export function dayGap(a: string, b: string): number {
  const msA = Date.parse(a)
  const msB = Date.parse(b)
  if (Number.isNaN(msA) || Number.isNaN(msB)) return Number.POSITIVE_INFINITY
  return Math.round((Math.abs(msA - msB) / MS_PER_DAY) * 100) / 100
}

export function normalizeTitleForDedupe(title: string): string {
  return title
    .normalize('NFKC')
    .toLowerCase()
    .replace(/【[^】]*】/g, '')
    .replace(/[「」『』"'“”]/g, '')
    .replace(/まとめ|速報|新商品/g, '')
    .replace(/\s+/g, '')
}

export function titlesSimilar(a: string, b: string): boolean {
  const na = normalizeTitleForDedupe(a)
  const nb = normalizeTitleForDedupe(b)
  if (!na || !nb) return false
  if (na.includes(nb) || nb.includes(na)) return true

  const ca = na.replace(WORK_NAME_RE, '')
  const cb = nb.replace(WORK_NAME_RE, '')
  if (!ca || !cb) return false
  return ca.includes(cb) || cb.includes(ca)
}

export function eventDatesOverlap(
  a: readonly EventDate[] | undefined,
  b: readonly EventDate[] | undefined,
): boolean {
  return overlappingRanges(a, b).length > 0
}

function overlappingRanges(
  a: readonly EventDate[] | undefined,
  b: readonly EventDate[] | undefined,
): string[] {
  if (!a?.length || !b?.length) return []
  const overlaps: string[] = []
  for (const left of a) {
    const [ls, le] = eventRange(left)
    for (const right of b) {
      const [rs, re] = eventRange(right)
      if (ls <= re && rs <= le) {
        const start = ls > rs ? ls : rs
        const end = le < re ? le : re
        overlaps.push(start === end ? start : `${start}..${end}`)
      }
    }
  }
  return [...new Set(overlaps)]
}

function eventRange(entry: EventDate): [string, string] {
  return [entry.date, entry.endDate ?? entry.date]
}
