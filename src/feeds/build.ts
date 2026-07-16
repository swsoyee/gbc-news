import type { NewsItem } from '../models/item.js'

export interface FeedMeta {
  title: string
  homeUrl: string
  feedUrl: string
  description: string
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function buildRss(items: NewsItem[], meta: FeedMeta): string {
  const now = new Date().toUTCString()
  const entries = items
    .map((item) => {
      const categories = item.categories
        .map((category) => `      <category>${escapeXml(category)}</category>`)
        .join('\n')
      const description = escapeXml(item.summary ?? item.title)
      return `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(item.url)}</link>
      <guid isPermaLink="true">${escapeXml(item.url)}</guid>
      <pubDate>${new Date(item.publishedAt).toUTCString()}</pubDate>
${categories}
      <description>${description}</description>
    </item>`
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(meta.title)}</title>
    <link>${escapeXml(meta.homeUrl)}</link>
    <description>${escapeXml(meta.description)}</description>
    <lastBuildDate>${now}</lastBuildDate>
    <atom:link xmlns:atom="http://www.w3.org/2005/Atom" href="${escapeXml(meta.feedUrl)}" rel="self" type="application/rss+xml" />
${entries}
  </channel>
</rss>
`
}

/** RFC5545：按 UTF-8 字节折行（最多 75 octets），避免日文标题被日历客户端拒收。 */
function foldIcs(line: string): string {
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()
  const bytes = encoder.encode(line)
  if (bytes.length <= 75) return line

  const parts: string[] = []
  let offset = 0
  let first = true
  while (offset < bytes.length) {
    const budget = first ? 75 : 74 // 续行以空格开头，占 1 byte
    let end = Math.min(offset + budget, bytes.length)
    // 不拆开多字节字符
    while (end > offset && (bytes[end]! & 0xc0) === 0x80) end -= 1
    if (end === offset) end = Math.min(offset + budget, bytes.length)

    const chunk = decoder.decode(bytes.subarray(offset, end))
    parts.push(first ? chunk : ` ${chunk}`)
    offset = end
    first = false
  }
  return parts.join('\r\n')
}

function icsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n/g, '\\n')
    .replace(/\n/g, '\\n')
}

function toIcsDateTimeUtc(iso: string): string {
  return iso.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

/** 新闻按「发布日」作为全天事件，兼容 Apple / Google 日历。 */
function toIcsDateValue(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!match) throw new Error(`Invalid publishedAt for iCal: ${iso}`)
  return `${match[1]}${match[2]}${match[3]}`
}

function nextIcsDateValue(yyyymmdd: string): string {
  const year = Number(yyyymmdd.slice(0, 4))
  const month = Number(yyyymmdd.slice(4, 6))
  const day = Number(yyyymmdd.slice(6, 8))
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() + 1)
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

export function buildIcal(items: NewsItem[], meta: FeedMeta): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//gbc-news//JP',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    foldIcs(`X-WR-CALNAME:${icsText(meta.title)}`),
  ]

  for (const item of items) {
    const stamp = toIcsDateTimeUtc(new Date().toISOString())
    const startDate = toIcsDateValue(item.publishedAt)
    const endDate = nextIcsDateValue(startDate)
    const tags = item.categories.map(icsText).join(',')

    lines.push('BEGIN:VEVENT')
    lines.push(foldIcs(`UID:${item.id}@gbc-news`))
    lines.push(`DTSTAMP:${stamp}`)
    lines.push(`DTSTART;VALUE=DATE:${startDate}`)
    lines.push(`DTEND;VALUE=DATE:${endDate}`)
    lines.push('TRANSP:TRANSPARENT')
    lines.push(foldIcs(`SUMMARY:${icsText(item.title)}`))
    lines.push(foldIcs(`DESCRIPTION:${icsText(item.summary ?? item.title)}`))
    lines.push(foldIcs(`URL:${item.url}`))
    lines.push(foldIcs(`CATEGORIES:${tags}`))
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')
  return `${lines.join('\r\n')}\r\n`
}
