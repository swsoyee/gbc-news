import type { FeedEntry } from './expand.js'

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

export function buildRss(entries: FeedEntry[], meta: FeedMeta): string {
  const now = new Date().toUTCString()
  const items = entries
    .map((entry) => {
      const categories = entry.categories
        .map((category) => `      <category>${escapeXml(category)}</category>`)
        .join('\n')
      const groups = entry.groups
        .map((group) => `      <category domain="group">${escapeXml(group)}</category>`)
        .join('\n')
      const description = escapeXml(entry.summary ?? entry.title)
      const guid = `${entry.entryId}@gbc-news`
      return `    <item>
      <title>${escapeXml(entry.title)}</title>
      <link>${escapeXml(entry.url)}</link>
      <guid isPermaLink="false">${escapeXml(guid)}</guid>
      <pubDate>${new Date(entry.occurredOn).toUTCString()}</pubDate>
${categories}
${groups}
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
${items}
  </channel>
</rss>
`
}

/** RFC5545：按 UTF-8 字节折行（最多 75 octets）；尽量不切断 http(s) URL。 */
function foldIcs(line: string): string {
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()
  const bytes = encoder.encode(line)
  if (bytes.length <= 75) return line

  const urlSpans = [...line.matchAll(/https?:\/\/[^\s\\]+/gi)].map((match) => ({
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
  }))

  const parts: string[] = []
  let offset = 0
  let first = true
  while (offset < bytes.length) {
    const budget = first ? 75 : 74 // 续行以空格开头，占 1 byte
    let end = Math.min(offset + budget, bytes.length)
    // 不拆开多字节字符
    while (end > offset && (bytes[end]! & 0xc0) === 0x80) end -= 1
    if (end === offset) end = Math.min(offset + budget, bytes.length)

    // 映射到字符下标，若切点落在 URL 内则前移到 URL 前，或整段纳入（放得下时）
    const charStart = decoder.decode(bytes.subarray(0, offset)).length
    let charEnd = decoder.decode(bytes.subarray(0, end)).length
    for (const span of urlSpans) {
      if (charStart < span.end && charEnd > span.start && charEnd < span.end) {
        if (span.start > charStart) {
          charEnd = span.start
        } else {
          const fullUrlEndOffset = encoder.encode(line.slice(0, span.end)).length
          if (fullUrlEndOffset - offset <= budget) charEnd = span.end
        }
        end = encoder.encode(line.slice(0, charEnd)).length
        while (end > offset && (bytes[end]! & 0xc0) === 0x80) end -= 1
        break
      }
    }
    if (end <= offset) end = Math.min(offset + budget, bytes.length)

    const chunk = decoder.decode(bytes.subarray(offset, end))
    parts.push(first ? chunk : ` ${chunk}`)
    offset = end
    first = false
  }
  return parts.join('\r\n')
}

/** 去掉正文中的 URL，避免摘要外链被折行切断后变成错误跳转。 */
function stripHttpUrls(value: string): string {
  return value
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function icsText(value: string): string {
  return value
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '') // 去掉 emoji，提升日历兼容性
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n/g, '\\n')
    .replace(/\n/g, '\\n')
    .replace(/\s+/g, ' ')
    .trim()
}

function escapeIcsUrl(url: string): string {
  return url.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,')
}

function toIcsDateTimeUtc(iso: string): string {
  return iso.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

function toIcsDateValue(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!match) throw new Error(`Invalid occurredOn for iCal: ${iso}`)
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

function truncateIcs(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value
  return `${value.slice(0, Math.max(0, maxChars - 1))}…`
}

/** 按活动日生成全天事件；DTSTART = occurredOn（非发稿日）。 */
export function buildIcal(entries: FeedEntry[], meta: FeedMeta): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//gbc-news//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-PUBLISHED-TTL:PT6H',
    'REFRESH-INTERVAL;VALUE=DURATION:PT6H',
    foldIcs(`X-WR-CALNAME:${icsText(meta.title)}`),
    foldIcs(`NAME:${icsText(meta.title)}`),
  ]

  for (const entry of entries) {
    const stamp = toIcsDateTimeUtc(entry.occurredOn)
    const summary = truncateIcs(icsText(entry.title), 80)
    // 摘要去外链并可截断；文末只追加本条目完整 URL（折行时不切断）
    const descriptionText = truncateIcs(icsText(stripHttpUrls(entry.summary ?? entry.title)), 200)
    const description = `${descriptionText}\\n${escapeIcsUrl(entry.url)}`
    const tags = [...entry.groups, ...entry.categories].map(icsText).join(',')
    const timed = Boolean(entry.endAt)

    lines.push('BEGIN:VEVENT')
    lines.push(foldIcs(`UID:${entry.entryId}@gbc-news`))
    lines.push(`DTSTAMP:${stamp}`)
    if (timed && entry.endAt) {
      lines.push(`DTSTART:${toIcsDateTimeUtc(entry.occurredOn)}`)
      lines.push(`DTEND:${toIcsDateTimeUtc(entry.endAt)}`)
      lines.push('TRANSP:OPAQUE')
    } else {
      const startDate = toIcsDateValue(entry.occurredOn)
      const endDate = nextIcsDateValue(startDate)
      lines.push(`DTSTART;VALUE=DATE:${startDate}`)
      lines.push(`DTEND;VALUE=DATE:${endDate}`)
      lines.push('TRANSP:TRANSPARENT')
    }
    lines.push('STATUS:CONFIRMED')
    lines.push(foldIcs(`SUMMARY:${summary}`))
    lines.push(foldIcs(`DESCRIPTION:${description}`))
    lines.push(foldIcs(`URL;VALUE=URI:${entry.url}`))
    if (tags) lines.push(foldIcs(`CATEGORIES:${tags}`))
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')
  return `${lines.join('\r\n')}\r\n`
}
