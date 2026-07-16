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

function foldIcs(line: string): string {
  const chunks: string[] = []
  let remaining = line
  while (remaining.length > 75) {
    chunks.push(remaining.slice(0, 75))
    remaining = ` ${remaining.slice(75)}`
  }
  chunks.push(remaining)
  return chunks.join('\r\n')
}

function icsText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

function toIcsDate(iso: string): string {
  return iso.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
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
    const stamp = toIcsDate(new Date().toISOString())
    const start = toIcsDate(item.publishedAt)
    lines.push('BEGIN:VEVENT')
    lines.push(foldIcs(`UID:${item.id}@gbc-news`))
    lines.push(`DTSTAMP:${stamp}`)
    lines.push(`DTSTART:${start}`)
    lines.push(foldIcs(`SUMMARY:${icsText(item.title)}`))
    lines.push(foldIcs(`DESCRIPTION:${icsText(item.summary ?? item.title)}`))
    lines.push(foldIcs(`URL:${item.url}`))
    lines.push(foldIcs(`CATEGORIES:${item.categories.join(',')}`))
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')
  return `${lines.join('\r\n')}\r\n`
}
