import { decodeHtml, decodeHtmlKeepNewlines, stripTags } from '../../utils/html.js'
import { parseIsoDate } from './urls.js'

export interface CollaboArticleDetail {
  title: string
  publishedAt: string
  bodyText: string
  summary: string
  imageUrl?: string
  /** `table.cc-table` 的 th→td（td 内 br 已换成换行） */
  ccTable: Record<string, string>
}

/** 解析 collabo-cafe 详情页。 */
export function parseNewsDetail(html: string): CollaboArticleDetail {
  const titleMatch = /<h1[^>]*class="[^"]*entry-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i.exec(html)
  const title = decodeHtml(stripTags(titleMatch?.[1] ?? '')).trim()
  if (!title) {
    throw new Error('Failed to parse collabo-cafe detail title')
  }

  const publishedAt = extractPublishedAt(html)
  const bodyHtml = extractEntryContent(html)
  const bodyText = decodeHtml(stripTags(bodyHtml)).trim()
  if (!bodyText) {
    throw new Error('Empty body in collabo-cafe news detail')
  }

  const summaryFromLd = extractJsonLdDescription(html)
  const summary = (summaryFromLd || bodyText).slice(0, 180)
  const imageUrl = extractImageUrl(html)
  const ccTable = parseCcTable(html)

  return {
    title,
    publishedAt,
    bodyText,
    summary,
    ...(imageUrl ? { imageUrl } : {}),
    ccTable,
  }
}

function extractPublishedAt(html: string): string {
  const ldMatch = /"datePublished"\s*:\s*"([^"]+)"/.exec(html)
  if (ldMatch?.[1]) return parseIsoDate(ldMatch[1])

  const metaMatch =
    /<meta[^>]+property="article:published_time"[^>]+content="([^"]+)"/i.exec(html) ??
    /<meta[^>]+content="([^"]+)"[^>]+property="article:published_time"/i.exec(html)
  if (metaMatch?.[1]) return parseIsoDate(metaMatch[1])

  throw new Error('Failed to parse collabo-cafe detail publishedAt')
}

function extractEntryContent(html: string): string {
  const sectionMatch =
    /<section[^>]*class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*?)<\/section>/i.exec(html)
  if (sectionMatch?.[1]) return sectionMatch[1]

  const divMatch = /<div[^>]*class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i.exec(html)
  if (divMatch?.[1]) return divMatch[1]

  throw new Error('Failed to parse collabo-cafe entry-content')
}

function extractJsonLdDescription(html: string): string | undefined {
  const match = /"description"\s*:\s*"((?:\\.|[^"\\])*)"/.exec(html)
  if (!match?.[1]) return undefined
  try {
    return JSON.parse(`"${match[1]}"`) as string
  } catch {
    return decodeHtml(match[1])
  }
}

function extractImageUrl(html: string): string | undefined {
  const ogMatch =
    /<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i.exec(html) ??
    /<meta[^>]+content="([^"]+)"[^>]+property="og:image"/i.exec(html)
  if (ogMatch?.[1]) return ogMatch[1].trim()

  const thumbMatch = /"thumbnailUrl"\s*:\s*"([^"]+)"/.exec(html)
  return thumbMatch?.[1]?.trim()
}

/** 解析首个 `table.cc-table`；同名 th 后者覆盖。 */
export function parseCcTable(html: string): Record<string, string> {
  const tableMatch = /<table[^>]*class="[^"]*cc-table[^"]*"[^>]*>([\s\S]*?)<\/table>/i.exec(html)
  if (!tableMatch?.[1]) return {}

  const rows: Record<string, string> = {}
  for (const row of tableMatch[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const thMatch = /<th[^>]*>([\s\S]*?)<\/th>/i.exec(row[1] ?? '')
    const tdMatch = /<td[^>]*>([\s\S]*?)<\/td>/i.exec(row[1] ?? '')
    if (!thMatch?.[1] || !tdMatch?.[1]) continue
    const key = decodeHtml(stripTags(thMatch[1])).trim()
    if (!key) continue
    const withBreaks = tdMatch[1].replace(/<br\s*\/?>/gi, '\n')
    const value = decodeHtmlKeepNewlines(stripTags(withBreaks)).trim()
    rows[key] = value
  }
  return rows
}
