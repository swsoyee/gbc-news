import type { EventDate, EventDateKind } from '../models/event-date.js'

interface LabelRule {
  kind: EventDateKind
  /** 匹配标签；用 g 扫全文 */
  label: RegExp
}

interface TimeSlot {
  startTime: string
  endTime?: string
}

/** D8：举办/出演 → hold；售票/通贩开始 → sale */
const LABEL_RULES: LabelRule[] = [
  { kind: 'hold', label: /開催日時/g },
  { kind: 'hold', label: /開催日程/g },
  { kind: 'hold', label: /開催期間/g },
  { kind: 'hold', label: /開催概要/g },
  { kind: 'hold', label: /開催日/g },
  { kind: 'hold', label: /出演日/g },
  { kind: 'hold', label: /■\s*日程/g },
  { kind: 'hold', label: /(?:^|[^\w])日程[：:\s]/g },
  { kind: 'sale', label: /チケット発売日/g },
  { kind: 'sale', label: /販売開始日時/g },
  { kind: 'sale', label: /発売日/g },
  { kind: 'sale', label: /通販[^\n]{0,12}開始/g },
  { kind: 'sale', label: /受注[^\n]{0,12}開始/g },
]

/** 标题/短摘要里表示「这是活动相关」的线索（用于无正式标签时的回退） */
const EVENT_CUE =
  /開催|出演|上映|発売|配信|ライブ|LIVE|ツアー|Tour|カフェ|フェス|ポップアップ|実施決定/

/**
 * 从标题/正文抽取活动相关日与可选时刻（D8/D9/D10）。
 * 抽不出则返回 []（该稿不进 feeds，仍可留在快照）。
 */
export function extractEventDates(title: string, body = '', publishedAt?: string): EventDate[] {
  const text = `${title}\n${body}`
  if (/営業日/.test(text) && !hasAllowedDateLabel(text) && !EVENT_CUE.test(text)) {
    return []
  }

  const found: EventDate[] = []
  const seen = new Set<string>()

  const push = (entry: EventDate) => {
    const key = `${entry.date}|${entry.kind}|${entry.startTime ?? ''}|${entry.endTime ?? ''}`
    if (seen.has(key)) return

    if (entry.startTime) {
      for (let i = found.length - 1; i >= 0; i -= 1) {
        const existing = found[i]!
        if (
          existing.date === entry.date &&
          existing.kind === entry.kind &&
          existing.startTime === undefined
        ) {
          seen.delete(`${existing.date}|${existing.kind}||`)
          found.splice(i, 1)
        }
      }
    }

    seen.add(key)
    found.push(entry)
  }

  const pushFromBlock = (block: string, kind: EventDateKind) => {
    for (const entry of datesWithTimes(sanitizeBlock(block), kind, publishedAt)) {
      push(entry)
    }
  }

  for (const rule of LABEL_RULES) {
    const flags = rule.label.flags.includes('g') ? rule.label.flags : `${rule.label.flags}g`
    const re = new RegExp(rule.label.source, flags)
    for (const match of text.matchAll(re)) {
      const start = match.index ?? 0
      const window = text.slice(start, start + Math.max(match[0].length + 40, 80))
      if (/営業日/.test(window) && !/\d{4}\s*年|\d{1,2}\s*月\s*\d{1,2}\s*日/.test(window)) {
        continue
      }

      const afterLabel = match[0].length
      const tail = text.slice(start)
      const end = findBlockEnd(tail, afterLabel)
      pushFromBlock(tail.slice(0, end), rule.kind)
    }
  }

  if (EVENT_CUE.test(title) || EVENT_CUE.test(text)) {
    const titleKind: EventDateKind = /発売|Release|通販|受注/.test(title) ? 'sale' : 'hold'
    pushFromBlock(title, titleKind)
    if (found.length === 0) {
      const headKind: EventDateKind = /発売|Release|通販|受注/.test(text) ? 'sale' : 'hold'
      pushFromBlock(body.slice(0, 400), headKind)
    }
  }

  enrichTimesFromText(found, text)

  return found.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.kind.localeCompare(b.kind) ||
      (a.startTime ?? '').localeCompare(b.startTime ?? ''),
  )
}

function datesWithTimes(block: string, kind: EventDateKind, publishedAt?: string): EventDate[] {
  const dates = extractDatesInBlock(block, publishedAt)
  if (dates.length === 0) return []

  const slots = extractTimeSlots(block)
  if (slots.length === 0) {
    return dates.map((date) => ({ date, kind }))
  }

  if (dates.length === 1) {
    return slots.map((slot) => ({
      date: dates[0]!,
      kind,
      startTime: slot.startTime,
      ...(slot.endTime ? { endTime: slot.endTime } : {}),
    }))
  }

  // 多日不共享单一时刻，避免把销售开始时间套到每一天
  return dates.map((date) => ({ date, kind }))
}

/** 開場/開演、OPEN/START、HH:mm～、N時 */
export function extractTimeSlots(block: string): TimeSlot[] {
  const slots: TimeSlot[] = []
  const seen = new Set<string>()

  const pushSlot = (hour: number, minute: number, endHour?: number, endMinute?: number) => {
    const startTime = tryHhmm(hour, minute)
    if (!startTime) return
    const endTime = endHour != null && endMinute != null ? tryHhmm(endHour, endMinute) : undefined
    const key = `${startTime}|${endTime ?? ''}`
    if (seen.has(key)) return
    seen.add(key)
    slots.push(endTime ? { startTime, endTime } : { startTime })
  }

  let matchedDoorShow = false
  for (const m of block.matchAll(
    /(?:開場|OPEN)\s*[/／]\s*(?:開演|START)\s*[：:]\s*(\d{1,2})\s*[:：]\s*(\d{2})\s*[/／]\s*(\d{1,2})\s*[:：]\s*(\d{2})/gi,
  )) {
    matchedDoorShow = true
    pushSlot(Number(m[3]), Number(m[4]))
  }

  for (const m of block.matchAll(
    /(?:開場|OPEN)\s*[：:]?\s*(\d{1,2})\s*[:：]\s*(\d{2})\s*[/／]\s*(?:開演|START)\s*[：:]?\s*(\d{1,2})\s*[:：]\s*(\d{2})/gi,
  )) {
    matchedDoorShow = true
    pushSlot(Number(m[3]), Number(m[4]))
  }

  if (!matchedDoorShow) {
    for (const m of block.matchAll(/(?:開演|START)\s*[：:]?\s*(\d{1,2})\s*[:：]\s*(\d{2})/gi)) {
      pushSlot(Number(m[1]), Number(m[2]))
    }
  }

  for (const m of block.matchAll(
    /(\d{1,2})\s*[:：]\s*(\d{2})\s*[〜～~－-]\s*(\d{1,2})\s*[:：]\s*(\d{2})/g,
  )) {
    pushSlot(Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]))
  }

  // 日)18:00〜 / 土)18:00
  for (const m of block.matchAll(/[日)）]\s*(\d{1,2})\s*[:：]\s*(\d{2})\s*[〜～~]?/g)) {
    pushSlot(Number(m[1]), Number(m[2]))
  }

  // 独立「18:00〜」
  for (const m of block.matchAll(/(?:^|[^\d/:])(\d{1,2})\s*[:：]\s*(\d{2})\s*[〜～~]/g)) {
    pushSlot(Number(m[1]), Number(m[2]))
  }

  // 20時～ / 13時 / 20時30分（避开「営業日」等已清理块）
  for (const m of block.matchAll(/(\d{1,2})\s*時(?:\s*(\d{2})\s*分)?\s*[〜～~]?/g)) {
    const hour = Number(m[1])
    const minute = m[2] != null ? Number(m[2]) : 0
    pushSlot(hour, minute)
  }

  return slots
}

function enrichTimesFromText(found: EventDate[], text: string): void {
  if (found.length !== 1 || found[0]!.startTime) return
  const slots = extractTimeSlots(text)
  if (slots.length === 0) return
  const slot = slots[0]!
  found[0]!.startTime = slot.startTime
  if (slot.endTime) found[0]!.endTime = slot.endTime
}

function hasAllowedDateLabel(text: string): boolean {
  return LABEL_RULES.some((rule) => new RegExp(rule.label.source, 'i').test(text))
}

/** 标签后内容块：跳过紧随的 開場/開演/会場 小节，直到下一主标签。 */
function findBlockEnd(tail: string, afterLabel: number): number {
  let searchFrom = afterLabel
  while (searchFrom < tail.length) {
    const nextMark = tail.slice(searchFrom).search(/■/)
    if (nextMark < 0) return Math.min(tail.length, afterLabel + 280)
    const abs = searchFrom + nextMark
    const heading = tail.slice(abs, abs + 16)
    if (/■\s*(開場|開演|OPEN|START|会場)/i.test(heading)) {
      searchFrom = abs + 1
      continue
    }
    return abs
  }
  return Math.min(tail.length, afterLabel + 280)
}

function sanitizeBlock(block: string): string {
  return block.replace(/最大\s*\d+\s*営業日[^\n]*/g, ' ').replace(/\d+\s*営業日/g, ' ')
}

function extractDatesInBlock(block: string, publishedAt?: string): string[] {
  const baseYear = yearFromIso(publishedAt) ?? new Date().getUTCFullYear()
  const dates: string[] = []

  for (const m of block.matchAll(
    /(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日[^\n]{0,24}?[/～〜~・\-–—]\s*(\d{1,2})\s*日/g,
  )) {
    dates.push(resolveDate(Number(m[1]), Number(m[2]), Number(m[3]), publishedAt, true))
    dates.push(resolveDate(Number(m[1]), Number(m[2]), Number(m[4]), publishedAt, true))
  }

  for (const m of block.matchAll(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/g)) {
    dates.push(resolveDate(Number(m[1]), Number(m[2]), Number(m[3]), publishedAt, true))
  }

  for (const m of block.matchAll(/(?:^|[^\d年])(\d{1,2})\s*月\s*(\d{1,2})\s*日/g)) {
    const idx = m.index ?? 0
    const before = block.slice(Math.max(0, idx - 8), idx)
    if (/\d{4}\s*年\s*$/.test(before) || /年\s*$/.test(before)) continue
    dates.push(resolveDate(baseYear, Number(m[1]), Number(m[2]), publishedAt, false))
  }

  for (const m of block.matchAll(/(?:^|[^\d])(\d{1,2})\/(\d{1,2})(?!\d)/g)) {
    const month = Number(m[1])
    const day = Number(m[2])
    if (month < 1 || month > 12 || day < 1 || day > 31) continue
    dates.push(resolveDate(baseYear, month, day, publishedAt, false))
  }

  return [...new Set(dates)]
}

function resolveDate(
  year: number,
  month: number,
  day: number,
  publishedAt: string | undefined,
  explicitYear: boolean,
): string {
  let y = year
  let iso = ymd(y, month, day)

  if (!explicitYear && publishedAt) {
    const pubDay = publishedAt.slice(0, 10)
    const pubMs = Date.parse(`${pubDay}T00:00:00.000Z`)
    const eventMs = Date.parse(`${iso}T00:00:00.000Z`)
    const dayMs = 86_400_000
    if (!Number.isNaN(pubMs) && !Number.isNaN(eventMs) && pubMs - eventMs > 300 * dayMs) {
      y += 1
      iso = ymd(y, month, day)
    }
  }

  return iso
}

function yearFromIso(iso?: string): number | null {
  if (!iso) return null
  const m = /^(\d{4})-/.exec(iso)
  return m ? Number(m[1]) : null
}

function ymd(year: number, month: number, day: number): string {
  const dt = new Date(Date.UTC(year, month - 1, day))
  if (dt.getUTCFullYear() !== year || dt.getUTCMonth() !== month - 1 || dt.getUTCDate() !== day) {
    throw new Error(`Invalid calendar date: ${year}-${month}-${day}`)
  }
  const m = String(month).padStart(2, '0')
  const d = String(day).padStart(2, '0')
  return `${year}-${m}-${d}`
}

function tryHhmm(hour: number, minute: number): string | null {
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}
