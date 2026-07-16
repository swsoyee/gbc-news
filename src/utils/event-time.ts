export interface EventSchedule {
  /** 事件开始日 ISO（UTC 午夜） */
  eventAt: string
  /** 事件结束日 ISO（可选；多日活动时为最后一天） */
  eventEndAt?: string
}

/**
 * 从标题/正文提取「发生日」。优先出演/開催/発売等标签，其次全文年月日，再次 M/D。
 * 找不到则返回 null（该类条目不进入日历）。
 */
export function extractEventSchedule(
  title: string,
  body = '',
  publishedAt?: string,
): EventSchedule | null {
  const text = `${title}\n${body}`
  const defaultYear = yearFromIso(publishedAt) ?? new Date().getUTCFullYear()

  const performance = datesFromLabel(text, /出演日/g, defaultYear)
  if (performance.length > 0) return scheduleFromDates(performance, publishedAt)

  const holding = datesFromLabel(text, /開催日(?:時|程|間)?/g, defaultYear)
  if (holding.length > 0) return scheduleFromDates(holding, publishedAt)

  const sale = datesFromLabel(text, /発売日/g, defaultYear)
  if (sale.length > 0) return scheduleFromDates(sale, publishedAt)

  const ymd = extractYmdList(text, defaultYear).filter((iso) => withinHorizon(iso, publishedAt))
  if (ymd.length > 0) return scheduleFromDates(ymd, publishedAt)

  const mdTitle = title.match(/(?:^|[^\d])(\d{1,2})\s*\/\s*(\d{1,2})\s*[（(]/)
  if (mdTitle) {
    return { eventAt: ymdToIso(defaultYear, Number(mdTitle[1]), Number(mdTitle[2])) }
  }

  const mdYori = text.match(/(\d{1,2})\s*\/\s*(\d{1,2})\s*[（(][^）)]+[）)]\s*より/)
  if (mdYori) {
    return { eventAt: ymdToIso(defaultYear, Number(mdYori[1]), Number(mdYori[2])) }
  }

  return null
}

function datesFromLabel(text: string, label: RegExp, defaultYear: number): string[] {
  const dates: string[] = []
  const flags = label.flags.includes('g') ? label.flags : `${label.flags}g`
  const re = new RegExp(label.source, flags)
  for (const match of text.matchAll(re)) {
    const start = match.index ?? 0
    const tail = text.slice(start)
    const afterLabel = match[0].length
    const nextMark = tail.slice(afterLabel).search(/■/)
    const end = nextMark >= 0 ? afterLabel + nextMark : Math.min(tail.length, afterLabel + 80)
    const block = tail.slice(0, end)
    dates.push(...extractYmdList(block, defaultYear))
  }
  return dates
}

function extractYmdList(text: string, defaultYear: number): string[] {
  const dates: string[] = []

  // 2026年9月5日(土)/6日(日) → 5日与6日
  for (const m of text.matchAll(
    /(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日[^\n]{0,20}?\/\s*(\d{1,2})\s*日/g,
  )) {
    dates.push(ymdToIso(Number(m[1]), Number(m[2]), Number(m[3])))
    dates.push(ymdToIso(Number(m[1]), Number(m[2]), Number(m[4])))
  }

  for (const m of text.matchAll(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/g)) {
    dates.push(ymdToIso(Number(m[1]), Number(m[2]), Number(m[3])))
  }

  // 省略年：9月6日
  for (const m of text.matchAll(/(?:^|[^\d年])(\d{1,2})\s*月\s*(\d{1,2})\s*日/g)) {
    dates.push(ymdToIso(defaultYear, Number(m[1]), Number(m[2])))
  }

  return dates
}

function scheduleFromDates(dates: string[], publishedAt?: string): EventSchedule {
  const sorted = [...new Set(dates)].sort()
  let start = sorted[0]!
  let end = sorted[sorted.length - 1]!

  // 跨度过大时（文中混入历史日期），取发稿后最近的一天
  if (daysBetween(start, end) > 120) {
    const pivot = publishedAt ?? start
    const upcoming = sorted.find((d) => d >= pivot.slice(0, 10)) ?? sorted.find((d) => d >= pivot)
    start = upcoming ?? start
    end = start
  }

  return end === start ? { eventAt: start } : { eventAt: start, eventEndAt: end }
}

function withinHorizon(iso: string, publishedAt?: string): boolean {
  if (!publishedAt) return true
  const pub = Date.parse(publishedAt)
  const event = Date.parse(iso)
  if (Number.isNaN(pub) || Number.isNaN(event)) return true
  const dayMs = 86_400_000
  // 允许发稿前 30 天到发稿后 540 天
  return event >= pub - 30 * dayMs && event <= pub + 540 * dayMs
}

function daysBetween(a: string, b: string): number {
  return Math.abs(Date.parse(b) - Date.parse(a)) / 86_400_000
}

function yearFromIso(iso?: string): number | null {
  if (!iso) return null
  const m = /^(\d{4})-/.exec(iso)
  return m ? Number(m[1]) : null
}

function ymdToIso(year: number, month: number, day: number): string {
  const dt = new Date(Date.UTC(year, month - 1, day))
  if (dt.getUTCFullYear() !== year || dt.getUTCMonth() !== month - 1 || dt.getUTCDate() !== day) {
    throw new Error(`Invalid calendar date: ${year}-${month}-${day}`)
  }
  const m = String(month).padStart(2, '0')
  const d = String(day).padStart(2, '0')
  return `${year}-${m}-${d}T00:00:00.000Z`
}
