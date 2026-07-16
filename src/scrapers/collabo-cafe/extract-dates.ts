import { extractEventDates } from '../../categories/extract-event-dates.js'
import type { EventDate } from '../../models/event-date.js'

const HOLD_KEYS = ['開催期間', '開催日程', '開催日', '期間']
const SALE_KEYS = ['予約期間', '予約受付', '販売期間']

/**
 * collabo-cafe 活动日：优先 cc-table，再列表 event-date，再标题/正文。
 * 多城市開催期間按行拆成多段 hold；预约截止 → sale。
 * 已有表格期间时不再合并列表总期间（避免 4/4〜6/18 这类总括伪区间）。
 */
export function extractCollaboEventDates(options: {
  title: string
  bodyText: string
  publishedAt: string
  ccTable: Record<string, string>
  listEventDateText?: string
}): EventDate[] {
  const tableBlocks: string[] = []

  for (const key of HOLD_KEYS) {
    const value = options.ccTable[key]
    if (!value) continue
    for (const line of splitPeriodLines(value)) {
      tableBlocks.push(`開催期間 ${line}`)
    }
  }

  for (const key of SALE_KEYS) {
    const value = options.ccTable[key]
    if (!value) continue
    tableBlocks.push(`発売日 ${value}`)
  }

  if (tableBlocks.length > 0) {
    return extractEventDates(options.title, tableBlocks.join('\n'), options.publishedAt)
  }

  const fallbackBlocks: string[] = []
  if (options.listEventDateText) {
    const listBlock = normalizeListEventDate(options.listEventDateText)
    if (listBlock) fallbackBlocks.push(listBlock)
  }

  const synthetic = fallbackBlocks.join('\n')
  let dates = extractEventDates(
    options.title,
    synthetic ? `${synthetic}\n${options.bodyText}` : options.bodyText,
    options.publishedAt,
  )

  if (dates.length === 0 && options.listEventDateText) {
    dates = extractEventDates(
      options.title,
      normalizeListEventDate(options.listEventDateText) ?? options.listEventDateText,
      options.publishedAt,
    )
  }

  return dates
}

function splitPeriodLines(value: string): string[] {
  return value
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && /\d/.test(line))
}

function normalizeListEventDate(raw: string): string | null {
  const text = raw.trim()
  if (!text) return null
  if (/予約/.test(text)) return `発売日 ${text}`
  const period = text.replace(/^期間\s*[:：]\s*/u, '').trim()
  if (!period) return null
  return `開催期間 ${period}`
}
