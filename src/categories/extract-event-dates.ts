import type { EventDate, EventDateKind } from '../models/event-date.js'
import { normalizeEventDate } from '../models/event-date.js'

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

/** pending 队列与规则抽取共用的活动线索。 */
export function hasEventCue(title: string, body = ''): boolean {
  return EVENT_CUE.test(`${title}\n${body}`)
}

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
    const key = eventKey(entry)
    if (seen.has(key)) return

    if (entry.startTime) {
      for (let i = found.length - 1; i >= 0; i -= 1) {
        const existing = found[i]!
        if (
          existing.date === entry.date &&
          (existing.endDate ?? '') === (entry.endDate ?? '') &&
          existing.kind === entry.kind &&
          existing.startTime === undefined
        ) {
          seen.delete(eventKey(existing))
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

  if (hasEventCue(title, body)) {
    const titleKind: EventDateKind = /発売|Release|通販|受注/.test(title) ? 'sale' : 'hold'
    pushFromBlock(title, titleKind)
    if (found.length === 0) {
      const headKind: EventDateKind = /発売|Release|通販|受注/.test(text) ? 'sale' : 'hold'
      pushFromBlock(body.slice(0, 400), headKind)
    }
  }

  enrichTimesFromText(found, text)

  return collapseContainedSingles(found)
    .map(normalizeEventDate)
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        (a.endDate ?? '').localeCompare(b.endDate ?? '') ||
        a.kind.localeCompare(b.kind) ||
        (a.startTime ?? '').localeCompare(b.startTime ?? ''),
    )
}

/** 同 kind 下，落在已有期间内的无时刻单日视为重复，去掉。 */
function collapseContainedSingles(entries: EventDate[]): EventDate[] {
  const periods = entries.filter((e) => e.endDate && e.endDate > e.date)
  if (periods.length === 0) return entries
  return entries.filter((entry) => {
    if (entry.endDate && entry.endDate > entry.date) return true
    if (entry.startTime) return true
    return !periods.some(
      (period) =>
        period.kind === entry.kind && entry.date >= period.date && entry.date <= period.endDate!,
    )
  })
}

function eventKey(entry: EventDate): string {
  return `${entry.date}|${entry.endDate ?? ''}|${entry.kind}|${entry.startTime ?? ''}|${entry.endTime ?? ''}`
}

interface DateSpan {
  date: string
  endDate?: string
  startTime?: string
  endTime?: string
}

function datesWithTimes(block: string, kind: EventDateKind, publishedAt?: string): EventDate[] {
  const spans = extractDateSpansInBlock(block, publishedAt)
  if (spans.length === 0) return []

  const toEntry = (span: DateSpan): EventDate => ({
    date: span.date,
    kind,
    ...(span.endDate ? { endDate: span.endDate } : {}),
    ...(span.startTime ? { startTime: span.startTime } : {}),
    ...(span.endTime ? { endTime: span.endTime } : {}),
  })

  const withOwnTime = spans.filter((s) => s.startTime)
  const needsSlots = spans.filter((s) => !s.startTime)
  const singlesNeedingSlots = needsSlots.filter((s) => !s.endDate)
  const periodsNeedingSlots = needsSlots.filter((s) => s.endDate)

  const slots = extractTimeSlots(block)
  const out: EventDate[] = [...withOwnTime.map(toEntry), ...periodsNeedingSlots.map(toEntry)]

  if (slots.length === 0 || singlesNeedingSlots.length === 0) {
    return [...out, ...singlesNeedingSlots.map(toEntry)]
  }

  if (
    singlesNeedingSlots.length === 1 &&
    periodsNeedingSlots.length === 0 &&
    withOwnTime.length === 0
  ) {
    return slots.map((slot) => ({
      date: singlesNeedingSlots[0]!.date,
      kind,
      startTime: slot.startTime,
      ...(slot.endTime ? { endTime: slot.endTime } : {}),
    }))
  }

  // 多日/多段不共享单一时刻，避免把销售开始时间套到每一天
  return [...out, ...singlesNeedingSlots.map(toEntry)]
}

/** 開場/開演、OPEN/START、HH:mm～、N時；「N時スタート（M時終了予定）」记为起止一对 */
export function extractTimeSlots(block: string): TimeSlot[] {
  const slots: TimeSlot[] = []
  const seen = new Set<string>()
  const covered = new Set<number>()

  const markCovered = (start: number, end: number) => {
    for (let i = start; i < end; i += 1) covered.add(i)
  }
  const overlapsCovered = (start: number, end: number) => {
    for (let i = start; i < end; i += 1) if (covered.has(i)) return true
    return false
  }

  const pushSlot = (
    hour: number,
    minute: number,
    endHour?: number,
    endMinute?: number,
    range?: { start: number; end: number },
  ) => {
    if (range && overlapsCovered(range.start, range.end)) return
    const startTime = tryHhmm(hour, minute)
    if (!startTime) return
    const endTime = endHour != null && endMinute != null ? tryHhmm(endHour, endMinute) : undefined
    const key = `${startTime}|${endTime ?? ''}`
    if (seen.has(key)) return
    seen.add(key)
    slots.push(endTime ? { startTime, endTime } : { startTime })
    if (range) markCovered(range.start, range.end)
  }

  // 配信 talk：19時スタート（20時終了予定）— 必须先于裸「N時」，否则会拆成两次开演
  for (const m of block.matchAll(
    /(\d{1,2})\s*時(?:\s*(\d{2})\s*分)?\s*(?:スタート|開始)\s*[（(]?\s*(\d{1,2})\s*時(?:\s*(\d{2})\s*分)?\s*終了(?:予定)?[）)]?/g,
  )) {
    const idx = m.index ?? 0
    pushSlot(
      Number(m[1]),
      m[2] != null ? Number(m[2]) : 0,
      Number(m[3]),
      m[4] != null ? Number(m[4]) : 0,
      { start: idx, end: idx + m[0].length },
    )
  }

  for (const m of block.matchAll(
    /(\d{1,2})\s*[:：]\s*(\d{2})\s*(?:スタート|開始)\s*[（(]?\s*(\d{1,2})\s*[:：]\s*(\d{2})\s*終了(?:予定)?[）)]?/g,
  )) {
    const idx = m.index ?? 0
    pushSlot(Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]), {
      start: idx,
      end: idx + m[0].length,
    })
  }

  let matchedDoorShow = false
  for (const m of block.matchAll(
    /(?:開場|OPEN)\s*[/／]\s*(?:開演|START)\s*[：:]\s*(\d{1,2})\s*[:：]\s*(\d{2})\s*[/／]\s*(\d{1,2})\s*[:：]\s*(\d{2})/gi,
  )) {
    matchedDoorShow = true
    const idx = m.index ?? 0
    pushSlot(Number(m[3]), Number(m[4]), undefined, undefined, {
      start: idx,
      end: idx + m[0].length,
    })
  }

  for (const m of block.matchAll(
    /(?:開場|OPEN)\s*[：:]?\s*(\d{1,2})\s*[:：]\s*(\d{2})\s*[/／]\s*(?:開演|START)\s*[：:]?\s*(\d{1,2})\s*[:：]\s*(\d{2})/gi,
  )) {
    matchedDoorShow = true
    const idx = m.index ?? 0
    pushSlot(Number(m[3]), Number(m[4]), undefined, undefined, {
      start: idx,
      end: idx + m[0].length,
    })
  }

  if (!matchedDoorShow) {
    for (const m of block.matchAll(/(?:開演|START)\s*[：:]?\s*(\d{1,2})\s*[:：]\s*(\d{2})/gi)) {
      const idx = m.index ?? 0
      pushSlot(Number(m[1]), Number(m[2]), undefined, undefined, {
        start: idx,
        end: idx + m[0].length,
      })
    }
  }

  for (const m of block.matchAll(
    /(\d{1,2})\s*[:：]\s*(\d{2})\s*[〜～~－-]\s*(\d{1,2})\s*[:：]\s*(\d{2})/g,
  )) {
    const idx = m.index ?? 0
    pushSlot(Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]), {
      start: idx,
      end: idx + m[0].length,
    })
  }

  // 日)18:00〜 / 土)18:00
  for (const m of block.matchAll(/[日)）]\s*(\d{1,2})\s*[:：]\s*(\d{2})\s*[〜～~]?/g)) {
    const idx = m.index ?? 0
    pushSlot(Number(m[1]), Number(m[2]), undefined, undefined, {
      start: idx,
      end: idx + m[0].length,
    })
  }

  // 独立「18:00〜」
  for (const m of block.matchAll(/(?:^|[^\d/:])(\d{1,2})\s*[:：]\s*(\d{2})\s*[〜～~]/g)) {
    const idx = m.index ?? 0
    const start = m[0].match(/^\d/) ? idx : idx + 1
    pushSlot(Number(m[1]), Number(m[2]), undefined, undefined, {
      start,
      end: idx + m[0].length,
    })
  }

  // 20時～ / 13時 / 20時30分（避开「営業日」等已清理块；已被起止对覆盖的跳过）
  for (const m of block.matchAll(/(\d{1,2})\s*時(?:\s*(\d{2})\s*分)?\s*[〜～~]?/g)) {
    const idx = m.index ?? 0
    const hour = Number(m[1])
    const minute = m[2] != null ? Number(m[2]) : 0
    pushSlot(hour, minute, undefined, undefined, { start: idx, end: idx + m[0].length })
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

/**
 * 抽取日期跨度：带 ～/〜/-/・/／ 的明确范围 → date+endDate；
 * 离散场次（顿号、换行列举）保持多条单日。
 */
function extractDateSpansInBlock(block: string, publishedAt?: string): DateSpan[] {
  const baseYear = yearFromIso(publishedAt) ?? new Date().getUTCFullYear()
  const spans: DateSpan[] = []
  const covered = new Set<number>()

  const mark = (start: number, end: number) => {
    for (let i = start; i < end; i += 1) covered.add(i)
  }
  const overlaps = (start: number, end: number) => {
    for (let i = start; i < end; i += 1) if (covered.has(i)) return true
    return false
  }
  const pushSpan = (span: DateSpan, start: number, end: number) => {
    if (overlaps(start, end)) return
    if (span.endDate && span.endDate < span.date) return
    if (span.endDate && span.endDate === span.date) {
      spans.push({
        date: span.date,
        ...(span.startTime ? { startTime: span.startTime } : {}),
        ...(span.endTime ? { endTime: span.endTime } : {}),
      })
    } else {
      spans.push(span)
    }
    mark(start, end)
  }

  // 跨月/跨年期间（可带起止时刻）：4月4日～5月10日 / 10月23日 20:00 ～ 10月29日 23:59
  for (const m of block.matchAll(
    /(?:(\d{4})\s*年\s*)?(\d{1,2})\s*月\s*(\d{1,2})\s*日(?:[（(][^）)]*[）)])?\s*(?:(\d{1,2})\s*[:：]\s*(\d{2}))?\s*[～〜~－\-–—]\s*(?:(\d{4})\s*年\s*)?(\d{1,2})\s*月\s*(\d{1,2})\s*日(?:[（(][^）)]*[）)])?\s*(?:(\d{1,2})\s*[:：]\s*(\d{2}))?/g,
  )) {
    const idx = m.index ?? 0
    const startYear = m[1] ? Number(m[1]) : m[6] ? Number(m[6]) : baseYear
    const endYear = m[6] ? Number(m[6]) : startYear
    const startExplicit = Boolean(m[1])
    const endExplicit = Boolean(m[6])
    const start = resolveDate(startYear, Number(m[2]), Number(m[3]), publishedAt, startExplicit)
    let end = resolveDate(endYear, Number(m[7]), Number(m[8]), publishedAt, endExplicit)
    // 省略年且结束月日早于开始：跨年（如 12月21日～1月3日）
    if (!m[1] && !m[6] && end < start) {
      end = resolveDate(startYear + 1, Number(m[7]), Number(m[8]), publishedAt, true)
    }
    const startTime = m[4] != null && m[5] != null ? tryHhmm(Number(m[4]), Number(m[5])) : null
    const endTime = m[9] != null && m[10] != null ? tryHhmm(Number(m[9]), Number(m[10])) : null
    pushSpan(
      {
        date: start,
        endDate: end,
        ...(startTime ? { startTime } : {}),
        ...(endTime ? { endTime } : {}),
      },
      idx,
      idx + m[0].length,
    )
  }

  // 同月跨日期间：2026年9月5日/6日、4月4日-5日
  for (const m of block.matchAll(
    /(?:(\d{4})\s*年\s*)?(\d{1,2})\s*月\s*(\d{1,2})\s*日[^\n]{0,24}?[/～〜~・\-–—]\s*(\d{1,2})\s*日/g,
  )) {
    const idx = m.index ?? 0
    if (overlaps(idx, idx + m[0].length)) continue
    const year = m[1] ? Number(m[1]) : baseYear
    const explicit = Boolean(m[1])
    const start = resolveDate(year, Number(m[2]), Number(m[3]), publishedAt, explicit)
    const end = resolveDate(year, Number(m[2]), Number(m[4]), publishedAt, explicit)
    pushSpan({ date: start, endDate: end }, idx, idx + m[0].length)
  }

  // M/D～M/D
  for (const m of block.matchAll(
    /(?:^|[^\d])(\d{1,2})\/(\d{1,2})\s*[～〜~－\-–—]\s*(\d{1,2})\/(\d{1,2})(?!\d)/g,
  )) {
    const idx = (m.index ?? 0) + (m[0].match(/^\d/) ? 0 : 1)
    const raw = m[0].replace(/^[^\d]/, '')
    if (overlaps(idx, idx + raw.length)) continue
    const sm = Number(m[1])
    const sd = Number(m[2])
    const em = Number(m[3])
    const ed = Number(m[4])
    if (sm < 1 || sm > 12 || sd < 1 || sd > 31 || em < 1 || em > 12 || ed < 1 || ed > 31) continue
    const start = resolveDate(baseYear, sm, sd, publishedAt, false)
    let end = resolveDate(baseYear, em, ed, publishedAt, false)
    if (end < start) end = resolveDate(baseYear + 1, em, ed, publishedAt, true)
    pushSpan({ date: start, endDate: end }, idx, idx + raw.length)
  }

  // 单日：完整年月日
  for (const m of block.matchAll(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/g)) {
    const idx = m.index ?? 0
    if (overlaps(idx, idx + m[0].length)) continue
    const date = resolveDate(Number(m[1]), Number(m[2]), Number(m[3]), publishedAt, true)
    pushSpan({ date }, idx, idx + m[0].length)
  }

  // 单日：省略年 M月D日
  for (const m of block.matchAll(/(?:^|[^\d年])(\d{1,2})\s*月\s*(\d{1,2})\s*日/g)) {
    const idx = m.index ?? 0
    const start = m[0].match(/^\d/) ? idx : idx + 1
    const before = block.slice(Math.max(0, idx - 8), idx)
    if (/\d{4}\s*年\s*$/.test(before) || /年\s*$/.test(before)) continue
    if (overlaps(start, start + m[0].replace(/^[^\d]/, '').length)) continue
    const raw = `${m[1]}月${m[2]}日`
    const date = resolveDate(baseYear, Number(m[1]), Number(m[2]), publishedAt, false)
    pushSpan({ date }, start, start + raw.length)
  }

  // 单日：M/D
  for (const m of block.matchAll(/(?:^|[^\d])(\d{1,2})\/(\d{1,2})(?!\d)/g)) {
    const month = Number(m[1])
    const day = Number(m[2])
    if (month < 1 || month > 12 || day < 1 || day > 31) continue
    const idx = (m.index ?? 0) + (m[0].match(/^\d/) ? 0 : 1)
    const raw = `${month}/${day}`
    if (overlaps(idx, idx + raw.length)) continue
    const date = resolveDate(baseYear, month, day, publishedAt, false)
    pushSpan({ date }, idx, idx + raw.length)
  }

  return dedupeSpans(spans)
}

function dedupeSpans(spans: DateSpan[]): DateSpan[] {
  const seen = new Set<string>()
  const out: DateSpan[] = []
  for (const span of spans) {
    const key = `${span.date}|${span.endDate ?? ''}|${span.startTime ?? ''}|${span.endTime ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(span)
  }
  return out
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
