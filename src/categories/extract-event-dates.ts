import type { EventDate, EventDateKind } from '../models/event-date.js'

interface LabelRule {
  kind: EventDateKind
  /** 匹配标签；用 g 扫全文 */
  label: RegExp
}

/** D8：举办/出演 → hold；售票/通贩开始 → sale */
const LABEL_RULES: LabelRule[] = [
  { kind: 'hold', label: /開催日時/g },
  { kind: 'hold', label: /開催日程/g },
  { kind: 'hold', label: /開催日/g },
  { kind: 'hold', label: /出演日/g },
  { kind: 'hold', label: /■\s*日程/g },
  { kind: 'hold', label: /(?:^|[^\w])日程[：:\s]/g },
  { kind: 'sale', label: /チケット発売日/g },
  { kind: 'sale', label: /発売日/g },
  { kind: 'sale', label: /通販[^\n]{0,12}開始/g },
  { kind: 'sale', label: /受注[^\n]{0,12}開始/g },
]

/**
 * 从标题/正文抽取活动相关日（D8/D9/D10）。
 * 抽不出则返回 []（该稿不进 feeds，仍可留在快照）。
 */
export function extractEventDates(title: string, body = '', publishedAt?: string): EventDate[] {
  const text = `${title}\n${body}`
  // 仅有「N営業日」类相对措辞、无明确活动标签时直接跳过
  if (/営業日/.test(text) && !hasAllowedDateLabel(text)) {
    return []
  }

  const found: EventDate[] = []
  const seen = new Set<string>()

  for (const rule of LABEL_RULES) {
    const flags = rule.label.flags.includes('g') ? rule.label.flags : `${rule.label.flags}g`
    const re = new RegExp(rule.label.source, flags)
    for (const match of text.matchAll(re)) {
      // 排除「最大N営業日」等：标签本身或紧随片段含 営業日 则跳过
      const start = match.index ?? 0
      const window = text.slice(start, start + Math.max(match[0].length + 40, 80))
      if (/営業日/.test(window) && !/\d{4}\s*年|\d{1,2}\s*月\s*\d{1,2}\s*日/.test(window)) {
        continue
      }

      const afterLabel = match[0].length
      const tail = text.slice(start)
      const nextMark = tail.slice(afterLabel).search(/■/)
      const end = nextMark >= 0 ? afterLabel + nextMark : Math.min(tail.length, afterLabel + 120)
      const block = sanitizeBlock(tail.slice(0, end))
      for (const date of extractDatesInBlock(block, publishedAt)) {
        const key = `${date}|${rule.kind}`
        if (seen.has(key)) continue
        seen.add(key)
        found.push({ date, kind: rule.kind })
      }
    }
  }

  return found.sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind))
}

function hasAllowedDateLabel(text: string): boolean {
  // 不用带 /g 的原正则 .test()，避免 lastIndex 状态污染
  return LABEL_RULES.some((rule) => new RegExp(rule.label.source, 'i').test(text))
}

function sanitizeBlock(block: string): string {
  // 去掉「最大5営業日以内」等相对措辞，避免误抽数字
  return block.replace(/最大\s*\d+\s*営業日[^\n]*/g, ' ').replace(/\d+\s*営業日/g, ' ')
}

function extractDatesInBlock(block: string, publishedAt?: string): string[] {
  const baseYear = yearFromIso(publishedAt) ?? new Date().getUTCFullYear()
  const dates: string[] = []

  // 2026年9月5日(土)/6日(日) 或 2026年3月28日(土)～29日(日)
  for (const m of block.matchAll(
    /(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日[^\n]{0,24}?[/～〜~・]\s*(\d{1,2})\s*日/g,
  )) {
    dates.push(resolveDate(Number(m[1]), Number(m[2]), Number(m[3]), publishedAt, true))
    dates.push(resolveDate(Number(m[1]), Number(m[2]), Number(m[4]), publishedAt, true))
  }

  for (const m of block.matchAll(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/g)) {
    dates.push(resolveDate(Number(m[1]), Number(m[2]), Number(m[3]), publishedAt, true))
  }

  // 省略年：9月6日 / 8月14日(金)
  for (const m of block.matchAll(/(?:^|[^\d年])(\d{1,2})\s*月\s*(\d{1,2})\s*日/g)) {
    // 跳过已被完整年月日覆盖的片段（避免重复）：若前 6 字符含「年」则是完整日期尾巴
    const idx = m.index ?? 0
    const before = block.slice(Math.max(0, idx - 6), idx)
    if (/\d{4}\s*$/.test(before) || /年\s*$/.test(before)) continue
    dates.push(resolveDate(baseYear, Number(m[1]), Number(m[2]), publishedAt, false))
  }

  return [...new Set(dates)]
}

/**
 * D9：显式年优先；省略年以发布年为基准，若推得日期相对发布日倒退超过一年则 +1 年。
 */
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
    // D9：倒退接近/超过一年则 +1。同年最大倒退 <365 天，故用 300 天捕捉跨年（如 12月发稿 + 1月省略年）。
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
